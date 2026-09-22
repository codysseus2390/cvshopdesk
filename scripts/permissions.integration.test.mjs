import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Disposable PostgreSQL only. There is deliberately no connection-string option.
// These auth/storage shims provide Supabase's schema surface, not token validation.
test("forward migrations enforce permission overrides on PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb$$;
      grant usage on schema auth, storage, public to authenticated, anon, service_role;
      create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant all on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    `);
    const migrations = new URL("../drizzle/migrations/", import.meta.url);
    const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", migrations), "utf8"));
    for (const entry of journal.entries) {
      await db.exec(readFileSync(new URL(`${entry.tag}.sql`, migrations), "utf8"));
    }
    const shop = "00000000-0000-4000-8000-000000000001";
    const otherShop = "00000000-0000-4000-8000-000000000002";
    const users = Object.fromEntries(
      ["owner", "manager", "staff", "display", "pending", "revoked", "other"].map((role, i) => [
        role,
        `00000000-0000-4000-8000-${String(101 + i).padStart(12, "0")}`,
      ]),
    );
    await db.query(
      "insert into public.shops(id,name,created_by) values ($1,'Test A',$2),($3,'Test B',$4)",
      [shop, users.owner, otherShop, users.other],
    );
    for (const [role, id] of Object.entries(users)) {
      await db.query(
        "insert into public.shop_members(shop_id,user_id,role,status) values ($1,$2,$3,$4)",
        [
          role === "other" ? otherShop : shop,
          id,
          ["pending", "revoked", "other"].includes(role) ? "staff" : role,
          ["pending", "revoked"].includes(role) ? role : "approved",
        ],
      );
    }
    await db.query("insert into public.customers(shop_id,name) values ($1,'Test customer')", [
      shop,
    ]);
    await db.query(
      "insert into public.role_permissions(shop_id,role,permission,allowed) values ($1,'manager','edit_records',false),($1,'manager','edit_dashboard_numbers',false),($1,'owner','edit_records',false)",
      [shop],
    );
    await db.exec("set role authenticated");
    const asUser = async (id) =>
      db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    for (const [role, id] of Object.entries(users)) {
      await asUser(id);
      const expected = role === "owner";
      const result = await db.query("select public.can_edit_records($1) as allowed", [shop]);
      assert.equal(result.rows[0].allowed, expected, `${role} edit permission`);
      const update = await db.query(
        "update public.customers set name='Updated' where shop_id=$1 returning id",
        [shop],
      );
      assert.equal(update.rows.length, expected ? 1 : 0, `${role} direct update affected rows`);
    }
    await asUser(users.manager);
    await assert.rejects(
      db.query(
        "select public.save_shop_metrics($1,'2026-09-21','daily',100,50,2,1,'manual',null,null,'[]',null)",
        [shop],
      ),
      /Not authorized/,
    );
    await asUser(users.owner);
    await db.query(
      "select public.save_shop_metrics($1,'2026-09-21','daily',100,50,2,1,'manual',null,null,'[]',null)",
      [shop],
    );
    await db.query(
      "select public.save_shop_metrics($1,'2026-09-21','daily',110,55,2,1,'manual',null,null,'[]','Correction')",
      [shop],
    );
    const history = await db.query(
      "select count(*)::int as total, count(*) filter(where is_current)::int as current from public.metric_snapshots where shop_id=$1",
      [shop],
    );
    assert.deepEqual(history.rows[0], { total: 2, current: 1 });
    await db.exec("reset role");
    await db.query(
      "insert into public.role_permissions(shop_id,role,permission,allowed) values ($1,'staff','edit_records',true)",
      [shop],
    );
    await db.exec("set role authenticated");
    await asUser(users.staff);
    const granted = await db.query(
      "update public.customers set name='Granted staff' where shop_id=$1 returning id",
      [shop],
    );
    assert.equal(granted.rows.length, 1, "explicit grant permits a real write");
    const spoof = await db.query("select public.can_edit_records($1,$2) as allowed", [
      shop,
      users.owner,
    ]);
    assert.equal(spoof.rows[0].allowed, false, "cannot borrow the owner's identity");
    await assert.rejects(
      db.query(
        "select public._save_metric_snapshot($1,'2026-09-21','daily',1,1,1,'manual',null,null,'[]',null)",
        [shop],
      ),
      /permission denied/,
    );
    console.log(
      `Applied ${journal.entries.length} migrations; checked seven identities, deny/grant, RPC denial and preserved history.`,
    );
  } finally {
    await db.close();
  }
});
