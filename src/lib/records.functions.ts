import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeRows, splitBoard } from "./import-records";
import { shopToday } from "./metrics-math";

export const listInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(120).default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("inventory_items")
      .select(
        "id, external_id, description, brand, size, quantity, price, cost, snapshot_date, needs_review, flags",
      )
      .order("snapshot_date", { ascending: false })
      .limit(200);
    if (data.search.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`description.ilike.${term},brand.ilike.${term},size.ilike.${term}`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(120).default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("customers")
      .select(
        "id, external_id, name, phone, email, first_seen_at, needs_review, flags, vehicles(id, year, make, model, vin, plate, needs_review)",
      )
      .order("name", { ascending: true })
      .limit(200);
    if (data.search.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: member } = await context.supabase
      .from("shop_members")
      .select("shop_id, shops(timezone)")
      .eq("user_id", context.userId)
      .eq("status", "approved")
      .maybeSingle();
    if (!member?.shop_id) throw new Error("You do not have access to a shop yet.");
    const timezone = (member.shops?.timezone as string | undefined) ?? "America/Chicago";

    const { data, error } = await context.supabase
      .from("shop_jobs")
      .select(
        "id, record_kind, external_id, identity_key, customer_name, vehicle_label, requested_service, technician, arrival_at, appointment_at, disposition, job_status, snapshot_at, local_status, local_note, local_updated_at, needs_review, flags",
      )
      .eq("is_current", true)
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const today = shopToday(timezone);
    const split = splitBoard(rows, Date.now(), { date: today, timezone });
    return {
      ...split,
      timezone,
      shopToday: today,
      fetchedAt: new Date().toISOString(),
      lastSnapshot: rows.reduce<string | null>(
        (acc, r) => (!acc || r.snapshot_at > acc ? r.snapshot_at : acc),
        null,
      ),
    };
  });

/** Local-only status and note. Never written back to TireShop. */
export const updateJobLocalState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        jobId: z.string().uuid(),
        local_status: z.string().max(60).nullable(),
        local_note: z.string().max(500).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shop_jobs")
      .update({
        local_status: data.local_status,
        local_note: data.local_note,
        local_updated_by: context.userId,
        local_updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const itemSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

/**
 * Saves reviewed rows from an import into inventory / customers / job snapshots.
 *
 * The whole save runs inside one database function so it either fully commits or
 * changes nothing. That function locks the import row, checks the signed-in user
 * belongs to the import's shop, refuses an import that was already accepted or
 * rejected, keeps previous snapshots as history, carries staff notes forward and
 * leaves records that were not in this file untouched.
 */
export const acceptImportRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        importId: z.string().uuid(),
        kind: z.enum(["inventory", "jobs", "appointments", "customers"]),
        snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        items: z.array(itemSchema).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const rows = normalizeRows(data.kind, data.items, data.importId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as unknown as { rpc: (f: string, a?: unknown) => any };
    const { data: result, error } = await sb.rpc("accept_import_records", {
      p_import_id: data.importId,
      p_kind: data.kind,
      p_snapshot_date: data.snapshot_date,
      p_rows: rows,
    });
    if (error) throw new Error(error.message);
    const summary = (result ?? {}) as { saved?: number; needs_review?: number };
    return { saved: summary.saved ?? 0, needsReview: summary.needs_review ?? 0 };
  });
