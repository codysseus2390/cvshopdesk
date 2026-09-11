/**
 * Authorization tests that run against the real database, so the checks that
 * matter (owner identity, membership role) are proven where they are enforced.
 * Every test runs inside a transaction that is rolled back, so no data is kept.
 */
import { describe, expect, it, afterAll } from "vitest";
import postgres from "postgres";

const url = process.env["SUPABASE_DB_URL"];
const sql = url ? postgres(url, { max: 1, prepare: false }) : null;
const run = url ? describe : describe.skip;

const OWNER = "codysseus2390@gmail.com";
const SPOOF_META = JSON.stringify({ email: OWNER, full_name: "Not the owner" });

afterAll(async () => {
  await sql?.end();
});

class Rollback extends Error {}

/** Runs `body` in a rolled-back transaction. */
async function inTx<T>(body: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let result!: T;
  try {
    await sql!.begin(async (tx) => {
      result = await body(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result;
}

async function makeUser(
  tx: postgres.TransactionSql,
  opts: { email: string; confirmed: boolean; metadata?: string },
): Promise<string> {
  const [row] = await tx`
    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            ${opts.email}, ${opts.confirmed ? new Date().toISOString() : null},
            ${opts.metadata ?? "{}"}::jsonb, now(), now())
    returning id`;
  return row!["id"] as string;
}

/** Impersonates a signed-in user, including any claims they could tamper with. */
async function actAs(tx: postgres.TransactionSql, userId: string, claims: object) {
  await tx`select set_config('role', 'authenticated', true)`;
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated", ...claims })}, true)`;
}

async function asService(tx: postgres.TransactionSql) {
  await tx`select set_config('role', 'postgres', true)`;
  await tx`select set_config('request.jwt.claims', '', true)`;
}

async function isOwner(tx: postgres.TransactionSql): Promise<boolean> {
  const [row] = await tx`select public.is_owner_email() as owner`;
  return row!["owner"] as boolean;
}

run("owner identity", () => {
  it("rejects a spoofed owner email in editable user metadata", async () => {
    const owner = await inTx(async (tx) => {
      const id = await makeUser(tx, {
        email: "attacker@example.com",
        confirmed: true,
        metadata: SPOOF_META,
      });
      // The attacker sends the owner address in both the top-level claim and metadata.
      await actAs(tx, id, { email: OWNER, user_metadata: JSON.parse(SPOOF_META) });
      return isOwner(tx);
    });
    expect(owner).toBe(false);
  });

  it("rejects the owner address before the email is confirmed", async () => {
    const owner = await inTx(async (tx) => {
      const id = await makeUser(tx, { email: OWNER, confirmed: false });
      await actAs(tx, id, { email: OWNER });
      return isOwner(tx);
    });
    expect(owner).toBe(false);
  });

  it("accepts only the confirmed owner account", async () => {
    const owner = await inTx(async (tx) => {
      const id = await makeUser(tx, { email: `  ${OWNER.toUpperCase()} `, confirmed: true });
      await actAs(tx, id, {});
      return isOwner(tx);
    });
    expect(owner).toBe(true);
  });

  it("rejects an anonymous session", async () => {
    const owner = await inTx(async (tx) => {
      await tx`select set_config('role', 'anon', true)`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ email: OWNER })}, true)`;
      return isOwner(tx);
    });
    expect(owner).toBe(false);
  });
});

run("membership requests", () => {
  async function setupShop(tx: postgres.TransactionSql) {
    const ownerId = await makeUser(tx, { email: OWNER, confirmed: true });
    const [shop] = await tx`
      insert into public.shops (name, created_by) values ('Test Shop', ${ownerId}) returning id`;
    const shopId = shop!["id"] as string;
    await tx`insert into public.shop_members (shop_id, user_id, email, role, status)
             values (${shopId}, ${ownerId}, ${OWNER}, 'owner', 'approved')`;
    const staffId = await makeUser(tx, { email: "staff@example.com", confirmed: true });
    return { ownerId, shopId, staffId };
  }

  it("blocks a self-service request that asks for the owner role", async () => {
    const error = await inTx(async (tx) => {
      const { shopId, staffId } = await setupShop(tx);
      await actAs(tx, staffId, {});
      try {
        await tx`insert into public.shop_members (shop_id, user_id, email, role, status)
                 values (${shopId}, ${staffId}, 'staff@example.com', 'owner', 'pending')`;
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(error).toBeTruthy();
  });

  it("blocks a self-service request that asks for manager or pre-approval", async () => {
    const results = await inTx(async (tx) => {
      const { shopId, staffId } = await setupShop(tx);
      await actAs(tx, staffId, {});
      const attempts: (string | null)[] = [];
      for (const [role, status] of [
        ["manager", "pending"],
        ["staff", "approved"],
      ] as const) {
        try {
          await tx.savepoint(async (sp) => {
            await sp`insert into public.shop_members (shop_id, user_id, email, role, status)
                     values (${shopId}, ${staffId}, 'staff@example.com', ${role}, ${status})`;
          });
          attempts.push(null);
        } catch (e) {
          attempts.push((e as Error).message);
        }
      }
      return attempts;
    });
    expect(results.every(Boolean)).toBe(true);
  });

  it("allows a pending staff request", async () => {
    const row = await inTx(async (tx) => {
      const { shopId, staffId } = await setupShop(tx);
      await actAs(tx, staffId, {});
      const [inserted] = await tx`
        insert into public.shop_members (shop_id, user_id, email, role, status)
        values (${shopId}, ${staffId}, 'staff@example.com', 'staff', 'pending')
        returning role, status`;
      return inserted;
    });
    expect(row!["role"]).toBe("staff");
    expect(row!["status"]).toBe("pending");
  });

  it("cannot be promoted to owner later, even by the shop owner", async () => {
    const error = await inTx(async (tx) => {
      const { ownerId, shopId, staffId } = await setupShop(tx);
      await tx`insert into public.shop_members (shop_id, user_id, email, role, status)
               values (${shopId}, ${staffId}, 'staff@example.com', 'staff', 'pending')`;
      await actAs(tx, ownerId, {});
      try {
        await tx`update public.shop_members set role = 'owner', status = 'approved'
                 where user_id = ${staffId}`;
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(error).toContain("owner role");
  });

  it("keeps the owner role attached to the account that created the shop", async () => {
    const error = await inTx(async (tx) => {
      const { shopId, staffId } = await setupShop(tx);
      await asService(tx);
      try {
        await tx`insert into public.shop_members (shop_id, user_id, email, role, status)
                 values (${shopId}, ${staffId}, 'staff@example.com', 'owner', 'approved')`;
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(error).toContain("owner role");
  });
});
