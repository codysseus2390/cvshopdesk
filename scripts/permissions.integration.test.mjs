import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Disposable PostgreSQL only. There is deliberately no connection-string option.
// These auth/storage shims provide Supabase's schema surface, not token validation.
// See torque-phase1-2-gaps.md "PGlite limits": this proves SQL policy/definer/trigger
// logic under real Postgres RLS with a shimmed auth.uid(); it does not prove real
// Supabase JWT/session/refresh behavior, deployed-state function diffs, UI/session
// boundary, or real network races.

async function createDb() {
  const db = new PGlite();
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
  return { db, migrationCount: journal.entries.length };
}

function asUserFn(db) {
  return (id) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}

/** Every non-owner-only permission key, mirroring src/lib/permissions.ts PERMISSIONS. */
const GRANTABLE_PERMISSION_KEYS = [
  "view_dashboard",
  "edit_dashboard_numbers",
  "upload_imports",
  "approve_imports",
  "edit_records",
  "view_productivity",
  "manage_staff",
  "manage_notifications",
  "access_tools",
  "use_assistant",
  "change_settings",
];

async function setOverride(db, shop, role, permission, allowed) {
  await db.exec("set role service_role");
  await db.query(
    `insert into public.role_permissions(shop_id,role,permission,allowed)
     values ($1,$2,$3,$4)
     on conflict (shop_id,role,permission) do update set allowed = excluded.allowed`,
    [shop, role, permission, allowed],
  );
  await db.exec("reset role");
  await db.exec("set role authenticated");
}

test("forward migrations enforce permission overrides on PostgreSQL", async () => {
  const { db, migrationCount } = await createDb();
  try {
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
    const asUser = asUserFn(db);
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
      `Applied ${migrationCount} migrations; checked seven identities, deny/grant, RPC denial and preserved history.`,
    );
  } finally {
    await db.close();
  }
});

test("grant/revoke matrix across newly-restricted tables (0023)", async () => {
  const { db } = await createDb();
  try {
    const shop = "00000000-0000-4000-8000-000000000201";
    const users = {
      owner: "00000000-0000-4000-8000-000000000301",
      manager: "00000000-0000-4000-8000-000000000302",
      staff: "00000000-0000-4000-8000-000000000303",
      display: "00000000-0000-4000-8000-000000000304",
    };
    await db.exec("set role service_role");
    await db.query("insert into public.shops(id,name,created_by) values ($1,'Matrix Shop',$2)", [
      shop,
      users.owner,
    ]);
    for (const [role, id] of Object.entries(users)) {
      await db.query(
        "insert into public.shop_members(shop_id,user_id,role,status) values ($1,$2,$3,'approved')",
        [shop, id, role],
      );
    }
    await db.query(
      "insert into public.metric_snapshots(shop_id,business_date,scope,gross_profit,tires_sold,car_count,source,entered_by,is_current) values ($1,'2026-09-01','daily',500,10,8,'manual',$2,true)",
      [shop, users.owner],
    );
    await db.query(
      "insert into public.metric_corrections(shop_id,business_date,scope,field,previous_value,new_value,corrected_by) values ($1,'2026-09-01','daily','gross_profit','400','500',$2)",
      [shop, users.owner],
    );
    await db.query(
      "insert into public.imports(shop_id,uploaded_by,file_name,storage_path,file_hash,report_scope,status) values ($1,$2,'report.csv','path/report.csv','hash-matrix-a','daily','uploaded')",
      [shop, users.owner],
    );
    await db.query(
      "insert into public.ai_actions(shop_id,user_id,tool,status) values ($1,$2,'lookup_metric','executed')",
      [shop, users.owner],
    );
    await db.query(
      "insert into public.technician_productivity(shop_id,business_date,technician,productivity_pct,entered_by) values ($1,'2026-09-01','Alex',80,$2)",
      [shop, users.owner],
    );
    await db.query(
      "insert into public.audit_events(shop_id,actor_id,action) values ($1,$2,'test_event')",
      [shop, users.owner],
    );
    await db.query(
      "insert into public.tire_orders(shop_id,customer_name,created_by) values ($1,'Walk-in',$2)",
      [shop, users.owner],
    );
    await db.exec("reset role");

    await db.exec("set role authenticated");
    const asUser = asUserFn(db);

    // --- shop_settings insert/update gated on change_settings ---
    await asUser(users.staff);
    await assert.rejects(
      db.query("insert into public.shop_settings(shop_id) values ($1)", [shop]),
      /row-level security/i,
      "staff without change_settings cannot create shop_settings",
    );
    await setOverride(db, shop, "staff", "change_settings", true);
    await asUser(users.staff);
    await db.query("insert into public.shop_settings(shop_id) values ($1)", [shop]);
    const settingsUpdated = await db.query(
      "update public.shop_settings set hidden_widgets='[\"x\"]' where shop_id=$1 returning shop_id",
      [shop],
    );
    assert.equal(settingsUpdated.rows.length, 1, "granted staff can update shop_settings");
    await setOverride(db, shop, "staff", "change_settings", false);
    await asUser(users.staff);
    const settingsDenied = await db.query(
      "update public.shop_settings set hidden_widgets='[\"y\"]' where shop_id=$1 returning shop_id",
      [shop],
    );
    assert.equal(
      settingsDenied.rows.length,
      0,
      "revoked staff's shop_settings update must report zero rows, not raise or succeed silently",
    );

    // --- ai_settings insert/update gated on change_settings ---
    await asUser(users.manager);
    await db.query("insert into public.ai_settings(shop_id) values ($1)", [shop]);
    const aiUpdated = await db.query(
      "update public.ai_settings set humor=false where shop_id=$1 returning shop_id",
      [shop],
    );
    assert.equal(aiUpdated.rows.length, 1, "manager keeps default change_settings for ai_settings");
    await setOverride(db, shop, "manager", "change_settings", false);
    await asUser(users.manager);
    const aiDenied = await db.query(
      "update public.ai_settings set humor=true where shop_id=$1 returning shop_id",
      [shop],
    );
    assert.equal(
      aiDenied.rows.length,
      0,
      "manager with change_settings revoked cannot update ai_settings (zero rows, not an error)",
    );

    // --- tire_orders DELETE gated on edit_records ---
    await setOverride(db, shop, "manager", "edit_records", false);
    await asUser(users.manager);
    const tireDeniedForManager = await db.query(
      "delete from public.tire_orders where shop_id=$1 returning id",
      [shop],
    );
    assert.equal(
      tireDeniedForManager.rows.length,
      0,
      "manager with edit_records revoked cannot delete tire orders",
    );
    await setOverride(db, shop, "staff", "edit_records", true);
    await asUser(users.staff);
    const tireDeletedByStaff = await db.query(
      "delete from public.tire_orders where shop_id=$1 returning id",
      [shop],
    );
    assert.equal(
      tireDeletedByStaff.rows.length,
      1,
      "staff explicitly granted edit_records can delete tire orders",
    );

    // --- metric_snapshots / metric_corrections SELECT gated on view_dashboard ---
    await setOverride(db, shop, "staff", "view_dashboard", false);
    await asUser(users.staff);
    const snapshotsDenied = await db.query(
      "select id from public.metric_snapshots where shop_id=$1",
      [shop],
    );
    assert.equal(snapshotsDenied.rows.length, 0, "view_dashboard revoked hides metric_snapshots");
    const correctionsDenied = await db.query(
      "select id from public.metric_corrections where shop_id=$1",
      [shop],
    );
    assert.equal(
      correctionsDenied.rows.length,
      0,
      "view_dashboard revoked hides metric_corrections",
    );
    await asUser(users.display);
    const snapshotsForDisplay = await db.query(
      "select id from public.metric_snapshots where shop_id=$1",
      [shop],
    );
    assert.equal(
      snapshotsForDisplay.rows.length,
      1,
      "display keeps its default view_dashboard read",
    );

    // --- imports SELECT gated on upload_imports OR approve_imports ---
    await setOverride(db, shop, "staff", "upload_imports", false);
    await asUser(users.staff);
    const importsDenied = await db.query("select id from public.imports where shop_id=$1", [shop]);
    assert.equal(
      importsDenied.rows.length,
      0,
      "staff with neither upload_imports nor approve_imports cannot read imports",
    );
    await setOverride(db, shop, "staff", "approve_imports", true);
    await asUser(users.staff);
    const importsViaApprove = await db.query("select id from public.imports where shop_id=$1", [
      shop,
    ]);
    assert.equal(
      importsViaApprove.rows.length,
      1,
      "approve_imports alone satisfies the imports read OR-gate",
    );

    // --- ai_actions SELECT gated on use_assistant ---
    await setOverride(db, shop, "staff", "use_assistant", false);
    await asUser(users.staff);
    const aiActionsDenied = await db.query("select id from public.ai_actions where shop_id=$1", [
      shop,
    ]);
    assert.equal(aiActionsDenied.rows.length, 0, "use_assistant revoked hides ai_actions");
    await setOverride(db, shop, "staff", "use_assistant", true);
    await asUser(users.staff);
    const aiActionsGranted = await db.query("select id from public.ai_actions where shop_id=$1", [
      shop,
    ]);
    assert.equal(aiActionsGranted.rows.length, 1, "use_assistant grant restores ai_actions read");

    // --- technician_productivity SELECT gated on view_productivity ---
    await asUser(users.staff);
    const productivityDenied = await db.query(
      "select id from public.technician_productivity where shop_id=$1",
      [shop],
    );
    assert.equal(
      productivityDenied.rows.length,
      0,
      "staff without view_productivity cannot read technician_productivity",
    );
    await setOverride(db, shop, "staff", "view_productivity", true);
    await asUser(users.staff);
    const productivityGranted = await db.query(
      "select id from public.technician_productivity where shop_id=$1",
      [shop],
    );
    assert.equal(
      productivityGranted.rows.length,
      1,
      "granted view_productivity restores technician_productivity read",
    );

    // --- audit_events: owner/manager-only invariant, never grantable ---
    for (const key of GRANTABLE_PERMISSION_KEYS) {
      await setOverride(db, shop, "staff", key, true);
    }
    await asUser(users.staff);
    const auditDenied = await db.query("select id from public.audit_events where shop_id=$1", [
      shop,
    ]);
    assert.equal(
      auditDenied.rows.length,
      0,
      "staff granted every grantable permission still cannot read audit_events (non-overridable invariant)",
    );
    await asUser(users.manager);
    const auditForManager = await db.query("select id from public.audit_events where shop_id=$1", [
      shop,
    ]);
    assert.equal(auditForManager.rows.length, 1, "manager keeps the audit_events invariant read");

    console.log(
      "Matrix: shop_settings, ai_settings, tire_orders DELETE, metric_snapshots/corrections, imports, ai_actions, technician_productivity, audit_events — grant/revoke and zero-row-on-revoke all checked.",
    );
  } finally {
    await db.close();
  }
});

test("staff and notification policies from migration 0023", async () => {
  const { db } = await createDb();
  try {
    const shop = "00000000-0000-4000-8000-000000000401";
    const otherShop = "00000000-0000-4000-8000-000000000402";
    const users = {
      owner: "00000000-0000-4000-8000-000000000501",
      staff: "00000000-0000-4000-8000-000000000502",
      staff2: "00000000-0000-4000-8000-000000000503",
      pending: "00000000-0000-4000-8000-000000000504",
      employee: "00000000-0000-4000-8000-000000000505",
    };
    const otherUser = "00000000-0000-4000-8000-000000000601";

    await db.exec("set role service_role");
    await db.query(
      "insert into public.shops(id,name,created_by) values ($1,'Staff Shop',$2),($3,'Other Shop',$4)",
      [shop, users.owner, otherShop, otherUser],
    );
    await db.query(
      "insert into public.shop_members(shop_id,user_id,role,status) values ($1,$2,'owner','approved'),($1,$3,'staff','approved'),($1,$6,'staff','approved'),($1,$4,'staff','pending'),($1,$5,'staff','approved'),($7,$8,'staff','approved')",
      [
        shop,
        users.owner,
        users.staff,
        users.pending,
        users.employee,
        users.staff2,
        otherShop,
        otherUser,
      ],
    );
    await db.exec("reset role");

    await db.exec("set role authenticated");
    const asUser = asUserFn(db);

    // staff_invites: gated on manage_staff
    await asUser(users.staff);
    await assert.rejects(
      db.query(
        "insert into public.staff_invites(shop_id,email,role,created_by) values ($1,'nobody@example.com','staff',$2)",
        [shop, users.staff],
      ),
      /row-level security/i,
      "staff without manage_staff cannot create staff_invites",
    );

    // role_permissions overrides key on role, not user id, so this grant also
    // covers staff2 (both are shop role "staff").
    await setOverride(db, shop, "staff", "manage_staff", true);
    await asUser(users.staff2);
    const inviteInsert = await db.query(
      "insert into public.staff_invites(shop_id,email,role,created_by) values ($1,'new-hire@example.com','staff',$2) returning id",
      [shop, users.staff2],
    );
    assert.equal(inviteInsert.rows.length, 1, "staff granted manage_staff can create an invite");

    // shop_members: managers/granted staff may approve a pending member, never the owner row
    const approve = await db.query(
      "update public.shop_members set status='approved', decided_by=$2 where shop_id=$1 and user_id=$3 returning user_id",
      [shop, users.staff2, users.pending],
    );
    assert.equal(approve.rows.length, 1, "staff granted manage_staff can approve a pending member");

    await setOverride(db, shop, "staff", "manage_staff", false);
    await asUser(users.staff);
    const approveDenied = await db.query(
      "update public.shop_members set status='revoked' where shop_id=$1 and user_id=$2 returning user_id",
      [shop, users.employee],
    );
    assert.equal(
      approveDenied.rows.length,
      0,
      "staff without manage_staff cannot decide membership",
    );

    // notifications: gated on manage_notifications
    await asUser(users.staff);
    await assert.rejects(
      db.query(
        "insert into public.notifications(shop_id,title,message,audience,created_by) values ($1,'Heads up','Read this','all',$2)",
        [shop, users.staff],
      ),
      /row-level security/i,
      "staff without manage_notifications cannot create a notification",
    );
    await setOverride(db, shop, "staff", "manage_notifications", true);
    await asUser(users.staff);
    const notif = await db.query(
      "insert into public.notifications(shop_id,title,message,audience,created_by) values ($1,'Heads up','Read this','specific',$2) returning id",
      [shop, users.staff],
    );
    const notificationId = notif.rows[0].id;
    assert.ok(notificationId, "granted staff can create a notification");

    // notification_recipients: target='display' with no user_id, same shop
    const displayRecipient = await db.query(
      "insert into public.notification_recipients(notification_id,shop_id,target,user_id) values ($1,$2,'display',null) returning id",
      [notificationId, shop],
    );
    assert.equal(displayRecipient.rows.length, 1, "display recipient in the same shop is allowed");

    // Malicious: recipient user_id from a different shop's membership
    await assert.rejects(
      db.query(
        "insert into public.notification_recipients(notification_id,shop_id,target,user_id) values ($1,$2,'user',$3)",
        [notificationId, shop, otherUser],
      ),
      /row-level security/i,
      "a recipient user_id must belong to the notification's own shop",
    );

    // Malicious: shop_id on the recipient row does not match the notification's shop
    await assert.rejects(
      db.query(
        "insert into public.notification_recipients(notification_id,shop_id,target,user_id) values ($1,$2,'user',$3)",
        [notificationId, otherShop, users.employee],
      ),
      /row-level security/i,
      "a recipient row's shop_id must match the notification's shop_id",
    );

    // Valid: an approved member of the notification's own shop
    const userRecipient = await db.query(
      "insert into public.notification_recipients(notification_id,shop_id,target,user_id) values ($1,$2,'user',$3) returning id",
      [notificationId, shop, users.employee],
    );
    assert.equal(userRecipient.rows.length, 1, "a same-shop approved member may be a recipient");

    // Reads: the named recipient and display both see their rows; an unrelated shop member does not
    await asUser(users.employee);
    const ownRead = await db.query("select id from public.notification_recipients where id=$1", [
      userRecipient.rows[0].id,
    ]);
    assert.equal(ownRead.rows.length, 1, "a recipient reads their own row");
    await asUser(otherUser);
    const foreignRead = await db.query(
      "select id from public.notification_recipients where id=$1",
      [userRecipient.rows[0].id],
    );
    assert.equal(
      foreignRead.rows.length,
      0,
      "a member of a different shop cannot read another shop's recipient row",
    );

    console.log(
      "0023 staff/notification policies: staff_invites, shop_members decisions, notifications, notification_recipients (grant/deny + shop/audience scoping) all checked.",
    );
  } finally {
    await db.close();
  }
});

test("same-table shop reassignment and malicious identifiers", async () => {
  const { db } = await createDb();
  try {
    const shop = "00000000-0000-4000-8000-000000000701";
    const otherShop = "00000000-0000-4000-8000-000000000702";
    const nonexistentShop = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const owner = "00000000-0000-4000-8000-000000000801";
    const pendingStaff = "00000000-0000-4000-8000-000000000802";
    const revokedStaff = "00000000-0000-4000-8000-000000000803";
    const otherOwner = "00000000-0000-4000-8000-000000000901";

    await db.exec("set role service_role");
    await db.query(
      "insert into public.shops(id,name,created_by) values ($1,'Shop A',$2),($3,'Shop B',$4)",
      [shop, owner, otherShop, otherOwner],
    );
    await db.query(
      "insert into public.shop_members(shop_id,user_id,role,status) values ($1,$2,'owner','approved'),($1,$3,'staff','pending'),($1,$4,'staff','revoked'),($5,$6,'owner','approved')",
      [shop, owner, pendingStaff, revokedStaff, otherShop, otherOwner],
    );
    const customer = await db.query(
      "insert into public.customers(shop_id,name) values ($1,'Reassignment target') returning id",
      [shop],
    );
    const customerId = customer.rows[0].id;
    await db.exec("reset role");

    await db.exec("set role authenticated");
    const asUser = asUserFn(db);

    // Same-table shop reassignment: the owner can edit within their own shop, but
    // cannot move a row into a shop they do not belong to. WITH CHECK failure on
    // UPDATE raises, it does not silently no-op.
    await asUser(owner);
    await assert.rejects(
      db.query("update public.customers set shop_id=$1 where id=$2", [otherShop, customerId]),
      /row-level security/i,
      "reassigning a record to a shop the actor does not belong to is rejected",
    );
    const stillOriginalShop = await db.query("select shop_id from public.customers where id=$1", [
      customerId,
    ]);
    assert.equal(
      stillOriginalShop.rows[0].shop_id,
      shop,
      "the rejected reassignment did not change the row",
    );

    // Malicious identifier #1 (beyond the existing auth.uid spoof in the first test):
    // a shop id that does not exist at all must resolve to "no permission", not error.
    const bogusShop = await db.query(
      "select public.has_shop_permission($1,'edit_records') as allowed",
      [nonexistentShop],
    );
    assert.equal(bogusShop.rows[0].allowed, false, "a nonexistent shop id grants nothing");

    // Malicious identifier #2: a real shop the caller is simply not a member of.
    const foreignShop = await db.query(
      "select public.has_shop_permission($1,'edit_records') as allowed",
      [otherShop],
    );
    assert.equal(
      foreignShop.rows[0].allowed,
      false,
      "a real but foreign shop id grants nothing to a non-member",
    );

    // Pending and revoked identities: present in shop_members, but not approved.
    await asUser(pendingStaff);
    const pendingRead = await db.query("select id from public.customers where shop_id=$1", [shop]);
    assert.equal(pendingRead.rows.length, 0, "a pending member cannot read shop records yet");
    const pendingPermission = await db.query(
      "select public.has_shop_permission($1,'view_dashboard') as allowed",
      [shop],
    );
    assert.equal(pendingPermission.rows[0].allowed, false, "a pending member has no permissions");

    await asUser(revokedStaff);
    const revokedRead = await db.query("select id from public.customers where shop_id=$1", [shop]);
    assert.equal(revokedRead.rows.length, 0, "a revoked member cannot read shop records");
    const revokedPermission = await db.query(
      "select public.has_shop_permission($1,'view_dashboard') as allowed",
      [shop],
    );
    assert.equal(revokedPermission.rows[0].allowed, false, "a revoked member has no permissions");

    console.log(
      "Malicious-identifier and reassignment checks: cross-shop update rejected, nonexistent/foreign shop ids, pending/revoked identities all resolve to no access.",
    );
  } finally {
    await db.close();
  }
});

test("anon cannot execute save_shop_metrics or save_period_productivity", async () => {
  const { db } = await createDb();
  try {
    const saveShopMetricsSig =
      "public.save_shop_metrics(uuid,date,report_scope,numeric,numeric,integer,integer,metric_source,uuid,text,jsonb,text)";
    const savePeriodProductivitySig =
      "public.save_period_productivity(uuid,date,text,numeric,text,report_scope,text)";

    const privileges = await db.query(
      "select has_function_privilege('anon', $1, 'execute') as a, has_function_privilege('anon', $2, 'execute') as b",
      [saveShopMetricsSig, savePeriodProductivitySig],
    );
    assert.equal(
      privileges.rows[0].a,
      false,
      "anon must not hold execute privilege on save_shop_metrics",
    );
    assert.equal(
      privileges.rows[0].b,
      false,
      "anon must not hold execute privilege on save_period_productivity",
    );

    await db.exec("set role anon");
    await assert.rejects(
      db.query(
        "select public.save_shop_metrics($1,'2026-09-21','daily',100,50,2,1,'manual',null,null,'[]',null)",
        ["00000000-0000-4000-8000-000000000001"],
      ),
      /permission denied/i,
      "an anonymous caller cannot execute save_shop_metrics at all",
    );
    await assert.rejects(
      db.query(
        "select public.save_period_productivity($1,'2026-09-21','Alex',80,'weekly','daily',null)",
        ["00000000-0000-4000-8000-000000000001"],
      ),
      /permission denied/i,
      "an anonymous caller cannot execute save_period_productivity at all",
    );

    console.log(
      "anon execute rejection confirmed for save_shop_metrics and save_period_productivity (privilege check + live call).",
    );
  } finally {
    await db.close();
  }
});

test("guard_business_calendar and save_business_calendar", async () => {
  const { db } = await createDb();
  try {
    const shop = "00000000-0000-4000-8000-000000001001";
    const owner = "00000000-0000-4000-8000-000000001101";
    const manager = "00000000-0000-4000-8000-000000001102";

    await db.exec("set role service_role");
    await db.query("insert into public.shops(id,name,created_by) values ($1,'Calendar Shop',$2)", [
      shop,
      owner,
    ]);
    await db.query(
      "insert into public.shop_members(shop_id,user_id,role,status) values ($1,$2,'owner','approved'),($1,$3,'manager','approved')",
      [shop, owner, manager],
    );
    await db.exec("reset role");

    await db.exec("set role authenticated");
    const asUser = asUserFn(db);

    const calendarA = JSON.stringify({
      schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
      exceptions: [],
    });
    const calendarB = JSON.stringify({
      schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5, 6] }],
      exceptions: [],
    });

    // Owner succeeds on first save (INSERT path): forward, non-retroactive.
    await asUser(owner);
    await db.query("select public.save_business_calendar($1,$2::jsonb,false,null)", [
      shop,
      calendarA,
    ]);
    const firstAudit = await db.query(
      "select action, detail from public.audit_events where shop_id=$1 and action like 'business_calendar_changed%' order by created_at asc",
      [shop],
    );
    assert.equal(firstAudit.rows.length, 1, "the first save writes exactly one audit row");
    assert.equal(firstAudit.rows[0].action, "business_calendar_changed");
    assert.equal(firstAudit.rows[0].detail.retroactive, false);
    assert.equal(firstAudit.rows[0].detail.previous, null);
    assert.deepEqual(firstAudit.rows[0].detail.next, JSON.parse(calendarA));

    // Owner succeeds on second save (UPDATE path), confirmed retroactive.
    //
    // KNOWN PRODUCT BUG (reported to Iron, not fixed here): save_business_calendar
    // writes via `insert ... on conflict (shop_id) do update`. Postgres fires a
    // table's BEFORE INSERT row trigger for the attempted insert even when the row
    // conflicts and the statement falls through to the DO UPDATE branch, in
    // addition to firing the BEFORE UPDATE trigger for the actual update (verified
    // with a minimal PGlite repro: a single ON CONFLICT DO UPDATE call fires
    // tg_op values ['INSERT','UPDATE'] where a plain first insert fires only
    // ['INSERT']). Because guard_business_calendar() unconditionally inserts an
    // audit_events row whenever tg_op='INSERT' and new.business_calendar is not
    // null, every call to save_business_calendar for a shop that already has a
    // shop_settings row (i.e. every call after the first) writes a *spurious
    // extra* audit_events row shaped like a fresh, non-retroactive
    // 'business_calendar_changed' with detail.previous incorrectly null, on top
    // of the correct row from the real UPDATE branch. Worse: because the
    // transaction-local app.calendar_retroactive setting is already in place
    // before the insert attempt fires, the spurious row is ALSO marked
    // action='business_calendar_changed_retroactive' with the same
    // retroactive/retroactive_from as the real row — the two are indistinguishable
    // except by the (incorrect) null `previous`. This duplicates and corrupts the
    // business-calendar audit trail. Deliberately not asserting an exact row count
    // here (it would either bake in the bug or make this test start failing the
    // moment Iron fixes it); instead this positively verifies the one *correct*
    // retroactive row (the one with the real previous value) exists with the
    // right shape.
    await db.query("select public.save_business_calendar($1,$2::jsonb,true,'2026-01-01')", [
      shop,
      calendarB,
    ]);
    const secondAudit = await db.query(
      "select action, detail from public.audit_events where shop_id=$1 and action like 'business_calendar_changed%' order by created_at asc",
      [shop],
    );
    assert.ok(
      secondAudit.rows.length >= 2,
      "the retroactive save adds at least one more audit row on top of the first save's row",
    );
    const retroRow = secondAudit.rows.find(
      (row) =>
        row.action === "business_calendar_changed_retroactive" &&
        row.detail.retroactive === true &&
        row.detail.retroactive_from === "2026-01-01" &&
        row.detail.previous !== null,
    );
    assert.ok(
      retroRow,
      "a correctly-marked retroactive audit row with the real previous value exists",
    );
    assert.deepEqual(retroRow.detail.previous, JSON.parse(calendarA));
    assert.deepEqual(retroRow.detail.next, JSON.parse(calendarB));

    // A manager with change_settings (the default) cannot write the calendar
    // directly against shop_settings: the trigger enforces owner-only regardless
    // of the table-level change_settings policy that otherwise lets managers in.
    await asUser(manager);
    await assert.rejects(
      db.query("update public.shop_settings set business_calendar=$1::jsonb where shop_id=$2", [
        calendarA,
        shop,
      ]),
      /Only the owner can change the business calendar/,
      "a manager's direct shop_settings write to business_calendar is rejected",
    );

    // A non-owner calling save_business_calendar itself is also rejected.
    await assert.rejects(
      db.query("select public.save_business_calendar($1,$2::jsonb,false,null)", [shop, calendarB]),
      /Only the owner can change the business calendar/,
      "a non-owner cannot call save_business_calendar",
    );

    console.log(
      "guard_business_calendar + save_business_calendar: owner forward/retroactive audit rows, manager direct-write rejection, non-owner RPC rejection all checked.",
    );
  } finally {
    await db.close();
  }
});

test("storage-uploads update/delete follow upload_imports grant/revoke", async () => {
  const { db } = await createDb();
  try {
    const shop = "00000000-0000-4000-8000-000000001201";
    const owner = "00000000-0000-4000-8000-000000001301";
    const staff = "00000000-0000-4000-8000-000000001302";
    const manager = "00000000-0000-4000-8000-000000001303";

    await db.exec("set role service_role");
    await db.query("insert into public.shops(id,name,created_by) values ($1,'Uploads Shop',$2)", [
      shop,
      owner,
    ]);
    await db.query(
      "insert into public.shop_members(shop_id,user_id,role,status) values ($1,$2,'owner','approved'),($1,$3,'staff','approved'),($1,$4,'manager','approved')",
      [shop, owner, staff, manager],
    );
    await db.exec("reset role");

    await db.exec("set role authenticated");
    const asUser = asUserFn(db);

    await asUser(owner);
    const object = await db.query(
      "insert into storage.objects(bucket_id,name) values ('shop-uploads',$1) returning id",
      [`${shop}/report.csv`],
    );
    const objectId = object.rows[0].id;

    // staff keeps the default upload_imports=true, so it can update the object.
    await asUser(staff);
    const renamed = await db.query("update storage.objects set name=$1 where id=$2 returning id", [
      `${shop}/renamed.csv`,
      objectId,
    ]);
    assert.equal(renamed.rows.length, 1, "staff with upload_imports can update a shop upload");

    // Revoke upload_imports for staff: update and delete both report zero rows,
    // not an error and not a false success.
    await setOverride(db, shop, "staff", "upload_imports", false);
    await asUser(staff);
    const updateDenied = await db.query(
      "update storage.objects set name=$1 where id=$2 returning id",
      [`${shop}/blocked.csv`, objectId],
    );
    assert.equal(updateDenied.rows.length, 0, "revoked staff cannot update a shop upload");
    const deleteDenied = await db.query("delete from storage.objects where id=$1 returning id", [
      objectId,
    ]);
    assert.equal(deleteDenied.rows.length, 0, "revoked staff cannot delete a shop upload");

    // The staff-role override does not leak to other roles: a manager (default
    // upload_imports=true, unaffected by the staff-only revoke above) can still
    // delete it.
    await asUser(manager);
    const deleted = await db.query("delete from storage.objects where id=$1 returning id", [
      objectId,
    ]);
    assert.equal(deleted.rows.length, 1, "a manager's default upload_imports still permits delete");

    console.log("storage.objects update/delete confirmed to follow upload_imports grant/revoke.");
  } finally {
    await db.close();
  }
});
