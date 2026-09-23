import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  monthToDate,
  shopToday,
  yearToDate,
  type MetricRow,
  type PeriodTotals,
} from "./metrics-math";
import {
  addDays,
  aggregatePeriod,
  resolvePeriod,
  type NumbersRow,
  type PeriodValues,
} from "./numbers-math";
import { buildNumbersReport, productivityValue } from "./numbers.server";
import { dashboardWeekFromReport } from "./dashboard-week";
import { overallProductivity, type ProductivityInput } from "./productivity-math";
import { MECHANICS } from "./mechanics";
import { readShopPermissions } from "./permissions.server";
import { readAllRows } from "./read-all-rows";
import { readBusinessCalendar } from "./calendar.server";
import { previousOpenDay } from "./business-calendar";
import { resolveShopTimeZone } from "./timezone";

type MonthTotals = PeriodValues & { gp_per_car: number | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    timezone: resolveShopTimeZone(data.shops?.timezone as string | null | undefined),
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
        sales: nullableNumber.optional(),
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

    const allowed = await readShopPermissions(supabase, shop.shopId, shop.role);
    if (!allowed("edit_dashboard_numbers"))
      throw new Error("You do not have permission to edit numbers.");

    const flags: string[] = [];
    if (data.sales === null || data.sales === undefined) flags.push("sales missing");
    if (data.gross_profit === null) flags.push("gross_profit missing");
    if (data.tires_sold === null) flags.push("tires_sold missing");
    if (data.car_count === null) flags.push("car_count missing");

    const sb = supabase as unknown as Supa;
    const { data: id, error } = await sb.rpc("save_shop_metrics", {
      p_shop_id: shop.shopId,
      p_business_date: data.business_date,
      p_scope: data.scope,
      p_sales: data.sales ?? null,
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
    const allowed = await readShopPermissions(supabase, shop.shopId, shop.role);
    if (!allowed("view_dashboard"))
      throw new Error("You do not have permission to view the dashboard.");
    const showProductivity = allowed("view_productivity");
    const calendar = await readBusinessCalendar(supabase, shop.shopId);
    const today = shopToday(shop.timezone);
    const year = today.slice(0, 4);
    const monthPrefix = today.slice(0, 7);

    const [{ data: rows }, { data: productivityRows }] = await Promise.all([
      readAllRows((from, to) =>
        supabase
          .from("metric_snapshots")
          .select(
            "id, business_date, scope, sales, gross_profit, tires_sold, car_count, source, created_at, flags, note",
          )
          .eq("is_current", true)
          .eq("shop_id", shop.shopId)
          .gte("business_date", `${Number(year) - 1}-01-01`)
          .lte("business_date", today)
          .order("business_date", { ascending: true })
          .order("id")
          .range(from, to),
      ),
      showProductivity
        ? readAllRows((from, to) =>
            supabase
              .from("technician_productivity")
              .select(
                "business_date, technician, productivity_pct, hours_billed, hours_worked, period_scope, updated_at",
              )
              .eq("shop_id", shop.shopId)
              .gte("business_date", `${Number(year) - 1}-01-01`)
              .lte("business_date", today)
              .order("business_date")
              .order("id")
              .range(from, to),
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    const all = (rows ?? []) as (MetricRow & { created_at: string; source: string })[];
    // Nothing dated after the shop's current business day counts toward current results.
    const current = all.filter((r) => r.business_date <= today);
    const todayRow = current.find((r) => r.business_date === today && r.scope === "daily") ?? null;
    // (b) No calendar configured: fall back to the plain previous calendar day and
    // tell the client so it can keep the legacy "Previous day" label instead of
    // claiming a calendar-confirmed "Previous open day".
    const calendarConfigured = calendar !== null;
    const previousDayKind: "open" | "calendar" = calendarConfigured ? "open" : "calendar";
    const calendarOrUndefined = calendar ?? undefined;
    let previousDay: string;
    if (calendar) {
      const open = previousOpenDay(today, calendar);
      if (!open) throw new Error("The shop calendar does not identify a previous open day.");
      previousDay = open;
    } else {
      previousDay = addDays(today, -1);
    }
    const previousDayRow =
      current.find((r) => r.business_date === previousDay && r.scope === "daily") ?? null;
    const mtd = monthToDate(current, monthPrefix, today, calendarOrUndefined);
    const productivity = (productivityRows ?? []) as ProductivityInput[];
    const [weekReport, monthReport] = await Promise.all([
      buildNumbersReport(supabase, shop, "weekly", today),
      buildNumbersReport(supabase, shop, "monthly", today),
    ]);
    const week = dashboardWeekFromReport(weekReport);
    const mtdProductivity =
      monthReport.rows.find((row) => row.key === "mechanic_productivity") ?? null;
    const previousDayProductivity = overallProductivity(
      productivity,
      { from: previousDay, to: previousDay },
      "daily",
      previousDay,
    );
    const mechanicNames = showProductivity ? [...MECHANICS] : [];
    const mechanics = {
      names: mechanicNames,
      previous_day: Object.fromEntries(
        mechanicNames.map((technician) => [
          technician,
          productivityValue(
            productivity,
            { from: previousDay, to: previousDay, kind: "daily" },
            technician,
          ),
        ]),
      ),
      week: Object.fromEntries(
        mechanicNames.map((technician) => [
          technician,
          weekReport.rows.find((row) => row.key === `productivity:${technician}`)?.actual ?? null,
        ]),
      ),
      month: Object.fromEntries(
        mechanicNames.map((technician) => [
          technician,
          monthReport.rows.find((row) => row.key === `productivity:${technician}`)?.actual ?? null,
        ]),
      ),
    };

    // The chart and the Numbers page read the same accepted monthly records
    // through the shared reporting aggregation, so corrections flow to both.
    const numbersRows = current as unknown as NumbersRow[];
    const monthly: { month: string; totals: MonthTotals }[] = [];
    for (const y of [String(Number(year) - 1), year]) {
      for (let m = 1; m <= 12; m++) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        if (!current.some((r) => r.business_date.startsWith(key))) continue;
        const values = aggregatePeriod(numbersRows, resolvePeriod("monthly", `${key}-01`), today);
        monthly.push({
          month: key,
          totals: {
            ...values,
            gross_profit: values.gross_profit,
            gp_per_car:
              values.gross_profit !== null && values.car_count !== null && values.car_count > 0
                ? values.gross_profit / values.car_count
                : null,
          },
        });
      }
    }

    const ytd = yearToDate(current, year, today, calendarOrUndefined);
    const ytdLastYear = yearToDate(current, String(Number(year) - 1), today, calendarOrUndefined);

    const lastUpdate = all.reduce<string | null>(
      (acc, r) => (acc === null || r.created_at > acc ? r.created_at : acc),
      null,
    );

    return {
      shop: { id: shop.shopId, name: shop.name, timezone: shop.timezone, role: shop.role },
      today,
      todayRow,
      calendarConfigured,
      previousDay,
      previousDayKind,
      previousDayRow,
      previousDayProductivity,
      mechanics,
      week,
      mtd: {
        ...mtd,
        mechanic_productivity: mtdProductivity?.actual ?? null,
        mechanic_productivity_goal: mtdProductivity?.goal ?? null,
      },
      ytd,
      ytdLastYear,
      monthly,
      lastUpdate,
      recent: current.slice(-14).reverse(),
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
    const shop = await resolveShop(supabase as unknown as Supa, userId);
    const allowed = await readShopPermissions(supabase, shop.shopId, shop.role);
    if (!allowed("view_dashboard")) {
      throw new Error("You do not have permission to view metric history.");
    }
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
