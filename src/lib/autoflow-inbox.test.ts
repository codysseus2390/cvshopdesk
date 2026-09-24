import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("keeps the inbox private, deduplicates retries, and preserves the first payload", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      CREATE TABLE public.shops(id uuid PRIMARY KEY);
      INSERT INTO public.shops VALUES ('00000000-0000-4000-8000-000000000001');
    `);
    await db.exec(
      readFileSync(
        new URL("../../drizzle/migrations/0025_autoflow_webhook_inbox.sql", import.meta.url),
        "utf8",
      ),
    );
    expect(
      (
        await db.query<{ relrowsecurity: boolean }>(
          "select relrowsecurity from pg_class where relname='autoflow_webhook_events'",
        )
      ).rows[0]?.relrowsecurity,
    ).toBe(true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query("SELECT * FROM public.autoflow_webhook_events")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query("INSERT INTO public.autoflow_webhook_events DEFAULT VALUES"),
      ).rejects.toThrow(/permission denied/);
      await db.exec("RESET ROLE");
    }
    await db.exec("SET ROLE service_role");
    const insert = `INSERT INTO public.autoflow_webhook_events
      (shop_id,autoflow_shop_id,event_id,event_type,payload)
      VALUES ('00000000-0000-4000-8000-000000000001','12','evt','status_update',$1)
      ON CONFLICT (shop_id,autoflow_shop_id,event_type,event_id) DO NOTHING`;
    await db.query(insert, [JSON.stringify({ status: "first" })]);
    await db.query(insert, [JSON.stringify({ status: "changed replay" })]);
    await expect(
      db.query("UPDATE public.autoflow_webhook_events SET payload='{}'"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query("DELETE FROM public.autoflow_webhook_events")).rejects.toThrow(
      /permission denied/,
    );
    const stored = await db.query<{ payload: unknown; processing_status: string }>(
      "SELECT payload, processing_status FROM public.autoflow_webhook_events",
    );
    expect(stored.rows).toEqual([
      { payload: { status: "first" }, processing_status: "pending_review" },
    ]);
  } finally {
    await db.close();
  }
}, 30_000);
