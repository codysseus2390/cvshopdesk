import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { monthToDate, shopToday, sumDaily, type MetricRow, type Totals } from "./metrics-math";

type Supa = { from: (t: string) => any; rpc: (f: string, a?: unknown) => any };

async function resolveShop(supabase: Supa, userId: string) {
  const { data } = await supabase
    .from("shop_members")
    .select("shop_id, role, shops(id, name, timezone)")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!data?.shop_id) throw new Error("You do not have access to a shop yet.");
  return {
    shopId: data.shop_id as string,
    role: data.role as string,
    timezone: (data.shops?.timezone as string) ?? "America/Chicago",
    name: (data.shops?.name as string) ?? "Cedar Valley",
  };
}

const nullableNumber = z
  .union([z.number(), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : Number(v)));

export const saveMetricEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        scope: z.enum(["daily", "mtd", "ytd"]),
        gross_profit: nullableNumber,
        tires_sold: nullableNumber,
        car_count: nullableNumber,
        note: z.string().max(1000).optional(),
        correction_note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const shop = await resolveShop(supabase as unknown as Supa, userId);

    const flags: string[] = [];
    if (data.gross_profit === null) flags.push("gross_profit missing");
    if (data.tires_sold === null) flags.push("tires_sold missing");
    if (data.car_count === null) flags.push("car_count missing");

    const sb = supabase as unknown as Supa;
    const { data: id, error } = await sb.rpc("save_metric_snapshot", {
      p_shop_id: shop.shopId,
      p_business_date: data.business_date,
      p_scope: data.scope,
      p_gross_profit: data.gross_profit,
      p_tires_sold: data.tires_sold,
      p_car_count: data.car_count,
      p_source: "manual",
      p_import_id: null,
      p_note: data.note ?? null,
      p_flags: flags,
      p_correction_note: data.correction_note ?? null,
    });
    if (error) throw new Error(error.message);
    return { snapshotId: id as string, flags };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const shop = await resolveShop(supabase as unknown as Supa, userId);
    const today = shopToday(shop.timezone);
    const year = today.slice(0, 4);
    const monthPrefix = today.slice(0, 7);

    const { data: rows, error } = await supabase
      .from("metric_snapshots")
      .select("id, business_date, scope, gross_profit, tires_sold, car_count, source, created_at, flags, note")
      .eq("is_current", true)
      .gte("business_date", `${Number(year) - 1}-01-01`)
      .order("business_date", { ascending: true });
    if (error) throw new Error(error.message);

    const all = (rows ?? []) as (MetricRow & { created_at: string; source: string })[];
    const todayRow = all.find((r) => r.business_date === today && r.scope === "daily") ?? null;
    const daysElapsed = Number(today.slice(8, 10));
    const mtd = monthToDate(all, monthPrefix, daysElapsed);

    const monthly: { month: string; totals: Totals }[] = [];
    for (const y of [String(Number(year) - 1), year]) {
      for (let m = 1; m <= 12; m++) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        const inMonth = all.filter((r) => r.business_date.startsWith(key));
        if (!inMonth.length) continue;
        const cumulative = inMonth
          .filter((r) => r.scope === "mtd")
          .sort((a, b) => (a.business_date < b.business_date ? 1 : -1))[0];
        const totals = cumulative
          ? {
              gross_profit: cumulative.gross_profit,
              tires_sold: cumulative.tires_sold,
              car_count: cumulative.car_count,
              gp_per_car:
                cumulative.gross_profit !== null && cumulative.car_count && cumulative.car_count > 0
                  ? cumulative.gross_profit / cumulative.car_count
                  : null,
              covered_days: 1,
              missing_days: 0,
            }
          : sumDaily(inMonth, new Date(Number(y), m, 0).getDate());
        monthly.push({ month: key, totals });
      }
    }

    const ytdRows = all.filter((r) => r.business_date.startsWith(year));
    const ytd = sumDaily(ytdRows, daysElapsed);

    const lastUpdate = all.reduce<string | null>(
      (acc, r) => (acc === null || r.created_at > acc ? r.created_at : acc),
      null,
    );

    return {
      shop: { id: shop.shopId, name: shop.name, timezone: shop.timezone, role: shop.role },
      today,
      todayRow,
      mtd,
      ytd,
      monthly,
      lastUpdate,
      recent: all.slice(-14).reverse(),
    };
  });

export const listMetricHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await resolveShop(supabase as unknown as Supa, userId);
    const { data: rows, error } = await supabase
      .from("metric_snapshots")
      .select(
        "id, business_date, scope, gross_profit, tires_sold, car_count, source, note, flags, is_current, created_at, superseded_at, import_id, imports(file_name, storage_path)",
      )
      .gte("business_date", data.from)
      .lte("business_date", data.to)
      .order("business_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: corrections } = await supabase
      .from("metric_corrections")
      .select("id, business_date, scope, field, previous_value, new_value, corrected_at, note")
      .gte("business_date", data.from)
      .lte("business_date", data.to)
      .order("corrected_at", { ascending: false });

    return { rows: rows ?? [], corrections: corrections ?? [] };
  });
