/**
 * Authorization tests.
 *
 * Two layers:
 *  - unit tests for the trusted-identity decision used by the server functions;
 *  - checks against the live database that the enforcement rules themselves say
 *    what they must say (the sandbox database role cannot create auth users or
 *    impersonate roles, so the guards are asserted by definition, not by replay).
 */
import { describe, expect, it, afterAll } from "vitest";
import postgres from "postgres";
import { evaluateIdentity, OWNER_EMAIL } from "./owner.server";

describe("trusted owner identity", () => {
  it("ignores an owner email spoofed into editable user metadata", () => {
    // The account's real address is the attacker's; metadata/claims are irrelevant
    // because evaluateIdentity only ever sees the auth store record.
    const identity = evaluateIdentity({
      email: "attacker@example.com",
      email_confirmed_at: new Date().toISOString(),
    });
    expect(identity.isOwner).toBe(false);
  });

  it("refuses the owner address until the email is confirmed", () => {
    expect(evaluateIdentity({ email: OWNER_EMAIL, email_confirmed_at: null }).isOwner).toBe(false);
    expect(evaluateIdentity({ email: OWNER_EMAIL }).isOwner).toBe(false);
  });

  it("accepts the confirmed owner account, normalizing case and spacing", () => {
    const identity = evaluateIdentity({
      email: `  ${OWNER_EMAIL.toUpperCase()} `,
      email_confirmed_at: new Date().toISOString(),
    });
    expect(identity.isOwner).toBe(true);
    expect(identity.email).toBe(OWNER_EMAIL);
  });

  it("treats a missing account as not the owner", () => {
    expect(evaluateIdentity({ email: null, email_confirmed_at: null }).isOwner).toBe(false);
  });
});

const url = process.env["SUPABASE_DB_URL"];
const sql = url ? postgres(url, { max: 1, prepare: false }) : null;
const dbTest = url ? describe : describe.skip;

afterAll(async () => {
  await sql?.end();
});

async function functionDef(name: string): Promise<string> {
  const rows = await sql!`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = ${name}`;
  return (rows[0]?.["def"] as string) ?? "";
}

dbTest("database ownership guard", () => {
  it("resolves the owner from the auth store, requiring a confirmed email", async () => {
    const def = await functionDef("is_owner_email");
    expect(def).toContain("auth.users");
    expect(def).toContain("auth.uid()");
    expect(def).toContain("email_confirmed_at is not null");
    expect(def).toContain(OWNER_EMAIL);
  });

  it("never reads client-controlled claims for ownership", async () => {
    const def = await functionDef("is_owner_email");
    expect(def).not.toContain("user_metadata");
    expect(def).not.toContain("auth.jwt");
  });

  it("only lets the shop creator hold the owner role", async () => {
    const def = await functionDef("enforce_member_role");
    expect(def).toContain("s.created_by = new.user_id");
    expect(def).toContain("raise exception");

    const [trigger] = await sql!`
      select tgname from pg_trigger
      where tgrelid = 'public.shop_members'::regclass and not tgisinternal
        and tgname = 'shop_members_role_guard'`;
    expect(trigger).toBeTruthy();
  });
});

dbTest("membership request policy", () => {
  it("forces self-service requests to pending staff", async () => {
    const [policy] = await sql!`
      select with_check from pg_policies
      where schemaname = 'public' and tablename = 'shop_members'
        and policyname = 'request own membership'`;
    const check = policy!["with_check"] as string;
    expect(check).toContain("user_id = auth.uid()");
    expect(check).toContain("status = 'pending'");
    expect(check).toContain("role = 'staff'");
  });

  it("restricts membership decisions to the shop owner", async () => {
    const [policy] = await sql!`
      select qual from pg_policies
      where schemaname = 'public' and tablename = 'shop_members'
        and cmd = 'UPDATE'`;
    expect(policy!["qual"] as string).toContain("is_shop_owner");
  });

  it("keeps every table locked to authenticated members", async () => {
    const rows = await sql!`
      select c.relname,
             c.relrowsecurity,
             (select count(*) from information_schema.role_table_grants g
               where g.table_schema = 'public' and g.table_name = c.relname
                 and g.grantee = 'anon') as anon_grants
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row["relrowsecurity"], `${row["relname"]} RLS`).toBe(true);
      expect(Number(row["anon_grants"]), `${row["relname"]} anon grants`).toBe(0);
    }
  });
});
