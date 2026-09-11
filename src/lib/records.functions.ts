import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeRows, splitBoard } from "./import-records";
import { shopToday } from "./metrics-math";


type Supa = { from: (t: string) => any };

async function resolveShopId(supabase: Supa, userId: string) {
  const { data } = await supabase
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!data?.shop_id) throw new Error("You do not have access to a shop yet.");
  return data.shop_id as string;
}

export const listInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().max(120).default("") }).parse(input))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("inventory_items")
      .select("id, external_id, description, brand, size, quantity, price, cost, snapshot_date")
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
  .inputValidator((input: unknown) => z.object({ search: z.string().max(120).default("") }).parse(input))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("customers")
      .select("id, external_id, name, phone, email, first_seen_at, vehicles(id, year, make, model, vin, plate)")
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
    const split = splitBoard(rows, Date.now());
    return {
      ...split,
      timezone,
      shopToday: shopToday(timezone),
      fetchedAt: new Date().toISOString(),
      lastSnapshot: rows.reduce<string | null>((acc, r) => (!acc || r.snapshot_at > acc ? r.snapshot_at : acc), null),
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
 * Existing rows are never deleted, so a partial import cannot silently close jobs.
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
    const { supabase, userId } = context;
    const shopId = await resolveShopId(supabase as unknown as Supa, userId);
    const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
    const num = (v: unknown) => {
      const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
    };

    let saved = 0;
    if (data.kind === "inventory") {
      const rows = data.items.map((i) => ({
        shop_id: shopId,
        import_id: data.importId,
        snapshot_date: data.snapshot_date,
        external_id: str(i["external_id"] ?? i["sku"] ?? i["part_number"]),
        description: str(i["description"] ?? i["item"] ?? i["name"]) ?? "Unlabelled item",
        brand: str(i["brand"]),
        size: str(i["size"]),
        quantity: num(i["quantity"] ?? i["qty"]),
        price: num(i["price"]),
        cost: num(i["cost"]),
      }));
      const { error } = await supabase.from("inventory_items").upsert(rows, {
        onConflict: "shop_id,snapshot_date,external_id,description",
        ignoreDuplicates: true,
      });
      if (error) throw new Error(error.message);
      saved = rows.length;
    } else if (data.kind === "customers") {
      for (const i of data.items) {
        const name = str(i["name"] ?? i["customer"] ?? i["customer_name"]);
        if (!name) continue;
        const externalId = str(i["external_id"] ?? i["customer_id"]);
        const { data: customer, error } = await supabase
          .from("customers")
          .upsert(
            {
              shop_id: shopId,
              import_id: data.importId,
              external_id: externalId,
              name,
              phone: str(i["phone"]),
              email: str(i["email"]),
            },
            { onConflict: "shop_id,external_id" },
          )
          .select("id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        saved += 1;
        const make = str(i["make"]);
        if (customer?.id && (make || str(i["vin"]))) {
          await supabase.from("vehicles").upsert(
            {
              shop_id: shopId,
              customer_id: customer.id,
              external_id: str(i["vehicle_id"] ?? i["vin"]),
              year: str(i["year"]),
              make,
              model: str(i["model"]),
              vin: str(i["vin"]),
              plate: str(i["plate"]),
            },
            { onConflict: "shop_id,external_id" },
          );
        }
      }
    } else {
      const kind = data.kind === "appointments" ? "appointment" : "job";
      const rows = data.items.map((i) => ({
        shop_id: shopId,
        import_id: data.importId,
        record_kind: kind,
        external_id: str(i["external_id"] ?? i["ticket"] ?? i["work_order"]),
        customer_name: str(i["customer_name"] ?? i["customer"] ?? i["name"]),
        vehicle_label: str(i["vehicle"] ?? i["vehicle_label"]),
        requested_service: str(i["service"] ?? i["requested_service"] ?? i["description"]),
        technician: str(i["technician"] ?? i["tech"]),
        arrival_at: str(i["arrival_at"]),
        appointment_at: str(i["appointment_at"] ?? i["appointment"]),
        disposition: str(i["disposition"]),
        job_status: str(i["status"] ?? i["job_status"]),
        snapshot_at: new Date().toISOString(),
        is_current: true,
      }));
      const withId = rows.filter((r) => r.external_id);
      const withoutId = rows.filter((r) => !r.external_id);
      if (withId.length) {
        const { error } = await supabase
          .from("shop_jobs")
          .upsert(withId, { onConflict: "shop_id,record_kind,external_id" });
        if (error) throw new Error(error.message);
      }
      if (withoutId.length) {
        const { error } = await supabase.from("shop_jobs").insert(withoutId);
        if (error) throw new Error(error.message);
      }
      saved = rows.length;
    }

    const { error: impError } = await supabase
      .from("imports")
      .update({ status: "accepted", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.importId);
    if (impError) throw new Error(impError.message);

    return { saved };
  });
