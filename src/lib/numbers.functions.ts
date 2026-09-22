import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { can, type PermissionKey } from "@/lib/permissions";
import { addDays, resolvePeriod } from "@/lib/numbers-math";
import { MECHANICS } from "@/lib/mechanics";

const periodInput = z.object({
  kind: z.enum(["weekly", "monthly", "yearly"]),
  anchor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const mechanicDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mechanicPeriodInput = z.object({ previous_day: mechanicDate, period_anchor: mechanicDate });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

async function requirePermission(supabase: unknown, userId: string, permission: PermissionKey) {
  const { resolveShop } = await import("./numbers.server");
  const shop = await resolveShop(supabase, userId);
  const { data: overrides, error: permissionError } = await (supabase as Supa)
    .from("role_permissions")
    .select("role, permission, allowed")
    .eq("shop_id", shop.shopId);
  if (permissionError) throw new Error("Unable to verify your permissions. Please try again.");
  if (
    !can(
      shop.role,
      permission,
      (overrides ?? []) as { role: string; permission: string; allowed: boolean }[],
    )
  ) {
    throw new Error("You do not have permission to do that.");
  }
  return shop;
}

function mechanicPeriodDates(
  previousDay: string,
  periodAnchor: string,
  occupiedDates = new Set<string>(),
) {
  const weeklyRange = resolvePeriod("weekly", periodAnchor);
  const monthlyRange = resolvePeriod("monthly", periodAnchor);
  const occupied = new Set(occupiedDates);
  occupied.add(previousDay);
  let weeklyDate = weeklyRange.from;
  while (occupied.has(weeklyDate)) weeklyDate = addDays(weeklyDate, 1);
  occupied.add(weeklyDate);
  let monthlyDate = monthlyRange.from;
  while (occupied.has(monthlyDate)) monthlyDate = addDays(monthlyDate, 1);
  return { weeklyDate, monthlyDate };
}

/** Load the three percentage rows used by the mechanic production entry form. */
export const getMechanicProductivityEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mechanicPeriodInput.parse(input))
  .handler(async ({ data, context }) => {
    const shop = await requirePermission(
      context.supabase,
      context.userId,
      "edit_dashboard_numbers",
    );
    const weeklyRange = resolvePeriod("weekly", data.period_anchor);
    const monthlyRange = resolvePeriod("monthly", data.period_anchor);
    const from = weeklyRange.from < monthlyRange.from ? weeklyRange.from : monthlyRange.from;
    const to = weeklyRange.to > monthlyRange.to ? weeklyRange.to : monthlyRange.to;
    const { data: existing, error } = await (context.supabase as Supa)
      .from("technician_productivity")
      .select("technician, business_date, period_scope, productivity_pct")
      .eq("shop_id", shop.shopId)
      .in("technician", [...MECHANICS])
      .gte("business_date", from)
      .lte("business_date", to);
    if (error) throw new Error(error.message);
    const dailyDates = new Set(
      ((existing ?? []) as { business_date: string; period_scope: string | null }[])
        .filter((row) => !row.period_scope)
        .map((row) => row.business_date),
    );
    const { weeklyDate, monthlyDate } = mechanicPeriodDates(
      data.previous_day,
      data.period_anchor,
      dailyDates,
    );
    const dates = new Set([data.previous_day, weeklyDate, monthlyDate]);
    return (
      (existing ?? []) as { business_date: string; productivity_pct: number | null }[]
    ).filter((row) => dates.has(row.business_date) && row.productivity_pct !== null);
  });

const nullablePercent = z
  .union([z.number().min(0).max(100), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : Number(v)));
const mechanicEntry = z.object({
  technician: z.enum(MECHANICS),
  previous_day: nullablePercent,
  weekly: nullablePercent,
  monthly: nullablePercent,
});

/** Save each mechanic's previous-day, weekly, and monthly production percentages. */
export const saveMechanicProductivityEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        previous_day: mechanicDate,
        period_anchor: mechanicDate,
        entries: z.array(mechanicEntry).length(MECHANICS.length),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const shop = await requirePermission(
      context.supabase,
      context.userId,
      "edit_dashboard_numbers",
    );
    const sb = context.supabase as Supa;
    const now = new Date().toISOString();
    const weeklyRange = resolvePeriod("weekly", data.period_anchor);
    const monthlyRange = resolvePeriod("monthly", data.period_anchor);
    const from = weeklyRange.from < monthlyRange.from ? weeklyRange.from : monthlyRange.from;
    const to = weeklyRange.to > monthlyRange.to ? weeklyRange.to : monthlyRange.to;
    const { data: existing, error: existingError } = await sb
      .from("technician_productivity")
      .select(
        "business_date, technician, period_scope, productivity_pct, hours_billed, hours_worked, cars, note, entered_by",
      )
      .eq("shop_id", shop.shopId)
      .in("technician", [...MECHANICS])
      .gte("business_date", from)
      .lte("business_date", to);
    if (existingError) throw new Error(existingError.message);

    // Keep period rows on dates that do not already hold daily entries. Old
    // period rows are nulled first so a moving free date cannot leave stale data.
    const dailyDates = new Set(
      ((existing ?? []) as { business_date: string; period_scope: string | null }[])
        .filter((row) => !row.period_scope)
        .map((row) => row.business_date),
    );
    const { weeklyDate, monthlyDate } = mechanicPeriodDates(
      data.previous_day,
      data.period_anchor,
      dailyDates,
    );
    const existingRows = (existing ?? []) as {
      business_date: string;
      technician: string;
      period_scope: string | null;
      hours_billed: number | null;
      hours_worked: number | null;
      cars: number | null;
      note: string | null;
      entered_by: string;
    }[];
    const existingByKey = new Map(
      existingRows.map((row) => [`${row.technician}|${row.business_date}`, row]),
    );
    const rowsByKey = new Map<string, Record<string, unknown>>();
    for (const row of existingRows) {
      const inWeekly =
        row.period_scope === "weekly" &&
        row.business_date >= weeklyRange.from &&
        row.business_date <= weeklyRange.to;
      const inMonthly =
        row.period_scope === "monthly" &&
        row.business_date >= monthlyRange.from &&
        row.business_date <= monthlyRange.to;
      if (!inWeekly && !inMonthly) continue;
      rowsByKey.set(`${row.technician}|${row.business_date}`, {
        shop_id: shop.shopId,
        business_date: row.business_date,
        technician: row.technician,
        productivity_pct: null,
        period_scope: row.period_scope,
        hours_billed: row.hours_billed,
        hours_worked: row.hours_worked,
        cars: row.cars,
        note: row.note,
        entered_by: row.entered_by,
        updated_at: now,
      });
    }
    for (const entry of data.entries) {
      const periodRows = [
        {
          business_date: data.previous_day,
          productivity_pct: entry.previous_day,
          period_scope: null,
        },
        { business_date: weeklyDate, productivity_pct: entry.weekly, period_scope: "weekly" },
        { business_date: monthlyDate, productivity_pct: entry.monthly, period_scope: "monthly" },
      ];
      for (const period of periodRows) {
        const prior = existingByKey.get(`${entry.technician}|${period.business_date}`);
        rowsByKey.set(`${entry.technician}|${period.business_date}`, {
          shop_id: shop.shopId,
          business_date: period.business_date,
          technician: entry.technician,
          productivity_pct: period.productivity_pct,
          period_scope: period.period_scope,
          hours_billed: prior?.hours_billed ?? null,
          hours_worked: prior?.hours_worked ?? null,
          cars: prior?.cars ?? null,
          note: prior?.note ?? null,
          entered_by: context.userId,
          updated_at: now,
        });
      }
    }
    const rows = [...rowsByKey.values()];
    const { data: saved, error } = await sb
      .from("technician_productivity")
      .upsert(rows, { onConflict: "shop_id,business_date,technician" })
      .select("technician, business_date, period_scope, productivity_pct");
    if (error) throw new Error(error.message);
    return { previousDay: data.previous_day, periodAnchor: data.period_anchor, rows: saved ?? [] };
  });

/** The full report for one period: actual, goal, variance, previous year, year-over-year. */
export const getNumbersReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodInput.parse(input))
  .handler(async ({ data, context }) => {
    const { buildNumbersReport, resolveShop } = await import("./numbers.server");
    const shop = await resolveShop(context.supabase, context.userId);
    const report = await buildNumbersReport(context.supabase, shop, data.kind, data.anchor);
    return { ...report, shop: { name: shop.name, timezone: shop.timezone, role: shop.role } };
  });

const nullableNumber = z
  .union([z.number(), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : Number(v)));

/**
 * Correction of a period's stored numbers. The previous snapshot is kept and
 * superseded, and every changed field is written to the correction history.
 */
export const saveNumbersCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["monthly", "yearly"]),
        anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sales: nullableNumber,
        gross_profit: nullableNumber,
        tires_sold: nullableNumber,
        car_count: nullableNumber,
        mechanic_productivity: nullableNumber.optional(),
        productivity: z
          .array(z.object({ technician: z.string().min(1).max(120), value: nullableNumber }))
          .max(40)
          .optional(),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const shop = await requirePermission(
      context.supabase,
      context.userId,
      "edit_dashboard_numbers",
    );
    const sb = context.supabase as unknown as Supa;
    const range = resolvePeriod(data.kind, data.anchor);
    const { shopToday } = await import("./metrics-math");
    const today = shopToday(shop.timezone);
    // Never date a correction in the future: current periods are stamped with the shop day.
    const businessDate = range.to > today && range.from <= today ? today : range.to;
    const scope = data.kind === "monthly" ? "mtd" : "ytd";

    const flags: string[] = [];
    for (const [field, value] of Object.entries({
      sales: data.sales,
      gross_profit: data.gross_profit,
      tires_sold: data.tires_sold,
      car_count: data.car_count,
    })) {
      if (value === null) flags.push(`${field} missing`);
    }

    const { data: snapshotId, error } = await sb.rpc("save_shop_metrics", {
      p_shop_id: shop.shopId,
      p_business_date: businessDate,
      p_scope: scope,
      p_sales: data.sales,
      p_gross_profit: data.gross_profit,
      p_tires_sold: data.tires_sold,
      p_car_count: data.car_count,
      p_source: "manual",
      p_import_id: null,
      p_note: data.note ?? "Manual correction from the Numbers page",
      p_flags: flags,
      p_correction_note: data.note ?? null,
    });
    if (error) throw new Error(error.message);

    if (data.mechanic_productivity !== undefined) {
      const { SHOP_PRODUCTIVITY_TECHNICIAN } = await import("./productivity-math");
      const { error: productivityError } = await sb.rpc("save_period_productivity", {
        p_shop_id: shop.shopId,
        p_business_date: businessDate,
        p_technician: SHOP_PRODUCTIVITY_TECHNICIAN,
        p_productivity_pct: data.mechanic_productivity,
        p_period_scope: data.kind,
        p_correction_scope: scope,
        p_note: data.note ?? null,
      });
      if (productivityError) throw new Error(productivityError.message);
    }

    for (const entry of data.productivity ?? []) {
      const { error: prodError } = await sb.rpc("save_period_productivity", {
        p_shop_id: shop.shopId,
        p_business_date: businessDate,
        p_technician: entry.technician,
        p_productivity_pct: entry.value,
        p_period_scope: data.kind,
        p_correction_scope: scope,
        p_note: data.note ?? null,
      });
      if (prodError) throw new Error(prodError.message);
    }

    await sb.rpc("log_audit_event", {
      p_action: "numbers_corrected",
      p_target: `${data.kind}:${range.label}`,
      p_detail: { business_date: businessDate, scope, note: data.note ?? null },
    });

    return { snapshotId: snapshotId as string, businessDate, scope, flags };
  });

/** Goal rules per metric: a fixed target or growth over the same period last year. */
export const saveNumbersGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        goal_rules: z.record(
          z.string().max(140),
          z.object({
            method: z.enum(["fixed", "growth"]),
            monthly: z.number().nullable().optional(),
            yearly: z.number().nullable().optional(),
            growth_pct: z.number().nullable().optional(),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const shop = await requirePermission(context.supabase, context.userId, "change_settings");
    if (shop.role !== "owner" && shop.role !== "manager") {
      throw new Error("Only the owner and admins can change goals.");
    }
    const sb = context.supabase as unknown as Supa;
    const { error } = await sb.from("shop_settings").upsert(
      {
        shop_id: shop.shopId,
        goal_rules: data.goal_rules,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id" },
    );
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit_event", {
      p_action: "numbers_goals_saved",
      p_target: "shop_settings.goal_rules",
      p_detail: { metrics: Object.keys(data.goal_rules).length },
    });
    return { ok: true };
  });
