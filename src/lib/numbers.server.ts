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

interface ProductivityRow {
  business_date: string;
  technician: string;
  productivity_pct: number | null;
  period_scope: string | null;
  note: string | null;
}

/** Period value for one technician: a saved period correction wins, else the average of daily entries. */
function productivityValue(rows: ProductivityRow[], range: PeriodRange, technician: string): number | null {
  const inRange = rows.filter(
    (r) => r.technician === technician && r.business_date >= range.from && r.business_date <= range.to,
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
  const range = resolvePeriod(kind, anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : today);
  const prev = previousYearPeriod(range);

  const [{ data: settings }, { data: metricRows }, { data: prodRows }, { data: corrections }] = await Promise.all([
    sb.from("shop_settings").select("targets, goal_rules, technician_goals").eq("shop_id", shop.shopId).maybeSingle(),
    sb
      .from("metric_snapshots")
      .select("business_date, scope, sales, gross_profit, tires_sold, car_count, created_at")
      .eq("is_current", true)
      .gte("business_date", prev.from)
      .lte("business_date", range.to),
    sb
      .from("technician_productivity")
      .select("business_date, technician, productivity_pct, period_scope, note")
      .gte("business_date", prev.from)
      .lte("business_date", range.to),
    sb
      .from("metric_corrections")
      .select("id, business_date, field, previous_value, new_value, corrected_at, note")
      .gte("business_date", range.from)
      .lte("business_date", range.to)
      .order("corrected_at", { ascending: false })
      .limit(50),
  ]);

  const rows = (metricRows ?? []) as NumbersRow[];
  const productivity = (prodRows ?? []) as ProductivityRow[];
  const goalRules = (settings?.goal_rules ?? {}) as GoalRules;
  const legacyTargets = (settings?.targets ?? {}) as Record<string, number | null>;

  const actuals = aggregatePeriod(rows, range, today);
  const previous = aggregatePeriod(rows, prev, today);
  const changedFields = new Set((corrections ?? []).map((c: { field: string }) => c.field));

  const technicians = Array.from(
    new Set([
      ...((settings?.technician_goals ?? []) as { technician: string }[]).map((g) => g.technician),
      ...productivity.map((p) => p.technician),
    ]),
  )
    .filter((t) => t && t.trim().length > 0)
    .sort();

  const report: ReportRow[] = [];
  for (const def of NUMBER_METRICS) {
    const actual = actuals[def.key as keyof typeof actuals] as number | null;
    const previousValue = previous[def.key as keyof typeof previous] as number | null;
    const legacy = legacyTargets[def.key];
    const rule: GoalRule | undefined =
      goalRules[def.key] ?? (legacy === null || legacy === undefined ? undefined : { method: "fixed", monthly: legacy });
    report.push(
      buildReportRow(def, actual, goalFor(def, rule, range, previousValue), previousValue, changedFields.has(def.key)),
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
        goalFor(def, goalRules[def.key], range, previousValue),
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
    corrections: (corrections ?? []) as NumbersReport["corrections"],
  };
}
