/**
 * Server-only builder for the Numbers report. One source of truth shared by the
 * Numbers page server functions and Hank's read tool — no second set of numbers.
 */
import {
  NUMBER_METRICS,
  aggregatePeriod,
  buildReportRow,
  goalFor,
  previousYearPeriod,
  productivityMetric,
  resolvePeriod,
  type GoalRule,
  type GoalRules,
  type NumbersRow,
  type PeriodKind,
  type PeriodRange,
  type ReportRow,
} from "./numbers-math";
import { shopToday } from "./metrics-math";
import { readShopPermissions } from "./permissions.server";
import { readAllRows } from "./read-all-rows";
import { readBusinessCalendar } from "./calendar.server";
import {
  overallProductivity,
  SHOP_PRODUCTIVITY_TECHNICIAN,
  type ProductivityInput,
} from "./productivity-math";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

export interface ShopRef {
  shopId: string;
  role: string;
  timezone: string;
  name: string;
}

export async function resolveShop(supabase: unknown, userId: string): Promise<ShopRef> {
  const sb = supabase as Supa;
  const { data } = await sb
    .from("shop_members")
    .select("shop_id, role, status, shops(id, name, timezone)")
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

interface ProductivityRow extends ProductivityInput {
  note: string | null;
}

/** Period value for one technician: a saved period correction wins, else the average of daily entries. */
export function productivityValue(
  rows: ProductivityInput[],
  range: { from: string; to: string; kind: PeriodKind | "daily" },
  technician: string,
): number | null {
  const inRange = rows.filter(
    (r) =>
      r.technician === technician && r.business_date >= range.from && r.business_date <= range.to,
  );
  const override = inRange
    .filter((r) => r.period_scope === range.kind && r.productivity_pct !== null)
    .sort((a, b) => (a.business_date < b.business_date ? 1 : -1))[0];
  if (override) return Number(override.productivity_pct);
  const daily = inRange.filter((r) => !r.period_scope && r.productivity_pct !== null);
  if (daily.length === 0) return null;
  return daily.reduce((sum, r) => sum + Number(r.productivity_pct), 0) / daily.length;
}

export interface NumbersReport {
  kind: PeriodKind;
  range: PeriodRange;
  previousRange: PeriodRange;
  shopToday: string;
  basis: string;
  as_of: string | null;
  covered_days: number;
  rows: ReportRow[];
  technicians: string[];
  goal_rules: GoalRules;
  corrections: {
    id: string;
    business_date: string;
    field: string;
    previous_value: string | null;
    new_value: string | null;
    corrected_at: string;
    note: string | null;
  }[];
}

export async function buildNumbersReport(
  supabase: unknown,
  shop: ShopRef,
  kind: PeriodKind,
  anchor?: string,
): Promise<NumbersReport> {
  const sb = supabase as Supa;
  const today = shopToday(shop.timezone);
  const allowed = await readShopPermissions(supabase, shop.shopId, shop.role);
  if (!allowed("view_dashboard")) throw new Error("You do not have permission to view reports.");
  const showProductivity = allowed("view_productivity");
  const calendar = await readBusinessCalendar(supabase, shop.shopId);
  const range = resolvePeriod(kind, anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : today);
  const prev = previousYearPeriod(range);

  const [
    { data: settings, error: settingsError },
    { data: metricRows, error: metricsError },
    { data: prodRows, error: productivityError },
    { data: corrections, error: correctionsError },
  ] = await Promise.all([
    sb
      .from("shop_settings")
      .select("targets, goal_rules, technician_goals")
      .eq("shop_id", shop.shopId)
      .maybeSingle(),
    readAllRows<NumbersRow>((from, to) =>
      sb
        .from("metric_snapshots")
        .select("business_date, scope, sales, gross_profit, tires_sold, car_count, created_at")
        .eq("shop_id", shop.shopId)
        .eq("is_current", true)
        .or(
          `and(business_date.gte.${prev.from},business_date.lte.${prev.to}),and(business_date.gte.${range.from},business_date.lte.${range.to})`,
        )
        .order("business_date")
        .order("id")
        .range(from, to),
    ),
    showProductivity
      ? readAllRows<ProductivityRow>((from, to) =>
          sb
            .from("technician_productivity")
            .select(
              "business_date, technician, productivity_pct, hours_billed, hours_worked, period_scope, note, updated_at",
            )
            .eq("shop_id", shop.shopId)
            .or(
              `and(business_date.gte.${prev.from},business_date.lte.${prev.to}),and(business_date.gte.${range.from},business_date.lte.${range.to})`,
            )
            .order("business_date")
            .order("id")
            .range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
    sb
      .from("metric_corrections")
      .select("id, business_date, field, previous_value, new_value, corrected_at, note")
      .eq("shop_id", shop.shopId)
      .gte("business_date", range.from)
      .lte("business_date", range.to)
      .order("corrected_at", { ascending: false })
      .limit(50),
  ]);
  if (settingsError || metricsError || productivityError || correctionsError)
    throw new Error("Unable to load the complete report. Please try again.");

  const rows = (metricRows ?? []) as NumbersRow[];
  const productivity = (prodRows ?? []) as ProductivityRow[];
  const goalRules = Object.fromEntries(
    Object.entries((settings?.goal_rules ?? {}) as GoalRules).filter(
      ([key]) =>
        showProductivity || (key !== "mechanic_productivity" && !key.startsWith("productivity:")),
    ),
  ) as GoalRules;
  const legacyTargets = (settings?.targets ?? {}) as Record<string, number | null>;

  const actuals = aggregatePeriod(rows, range, today);
  const previous = aggregatePeriod(rows, prev, today);
  const changedFields = new Set((corrections ?? []).map((c: { field: string }) => c.field));

  const technicians = Array.from(
    new Set([
      ...(
        (showProductivity ? (settings?.technician_goals ?? []) : []) as { technician: string }[]
      ).map((g) => g.technician),
      ...productivity.map((p) => p.technician),
    ]),
  )
    .filter((t) => t && t !== SHOP_PRODUCTIVITY_TECHNICIAN && t.trim().length > 0)
    .sort();

  const mechanicActual = overallProductivity(productivity, range, kind, today);
  const mechanicPrevious = overallProductivity(productivity, prev, kind, today);

  const report: ReportRow[] = [];
  for (const def of NUMBER_METRICS) {
    if (def.key === "mechanic_productivity" && !showProductivity) continue;
    const actual =
      def.key === "mechanic_productivity"
        ? mechanicActual
        : (actuals[def.key as keyof typeof actuals] as number | null);
    const previousValue =
      def.key === "mechanic_productivity"
        ? mechanicPrevious
        : (previous[def.key as keyof typeof previous] as number | null);
    const legacy = legacyTargets[def.key];
    const rule: GoalRule | undefined =
      goalRules[def.key] ??
      (legacy === null || legacy === undefined ? undefined : { method: "fixed", monthly: legacy });
    report.push(
      buildReportRow(
        def,
        actual,
        goalFor(def, rule, range, previousValue, calendar),
        previousValue,
        changedFields.has(def.key),
      ),
    );
  }
  for (const technician of technicians) {
    const def = productivityMetric(technician);
    const actual = productivityValue(productivity, range, technician);
    const previousValue = productivityValue(productivity, prev, technician);
    report.push(
      buildReportRow(
        def,
        actual,
        goalFor(def, goalRules[def.key], range, previousValue, calendar),
        previousValue,
        changedFields.has(def.key),
      ),
    );
  }

  return {
    kind,
    range,
    previousRange: prev,
    shopToday: today,
    basis: actuals.basis,
    as_of: actuals.as_of,
    covered_days: actuals.covered_days,
    rows: report,
    technicians,
    goal_rules: goalRules,
    corrections: ((corrections ?? []) as NumbersReport["corrections"]).filter(
      (row) =>
        showProductivity ||
        (row.field !== "mechanic_productivity" && !row.field.startsWith("productivity:")),
    ),
  };
}
