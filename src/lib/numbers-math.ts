/**
 * Pure period / goal / variance math for the Numbers page.
 *
 * Rules kept from the dashboard math:
 *  - Missing values stay null ("Not updated"); a verified 0 is a real value.
 *  - Cumulative (mtd / ytd) snapshots replace a daily sum, never add to it.
 *  - No misleading percentages when the base is zero or unknown.
 */

export type PeriodKind = "weekly" | "monthly" | "yearly";

export interface PeriodRange {
  kind: PeriodKind;
  /** Inclusive YYYY-MM-DD bounds. */
  from: string;
  to: string;
  label: string;
}

const DAY = 86_400_000;

function toUTC(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUTC(toUTC(date) + days * DAY);
}

export function daysInMonth(monthPrefix: string): number {
  return new Date(
    Date.UTC(Number(monthPrefix.slice(0, 4)), Number(monthPrefix.slice(5, 7)), 0),
  ).getUTCDate();
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabel(monthPrefix: string): string {
  return `${MONTHS[Number(monthPrefix.slice(5, 7)) - 1]} ${monthPrefix.slice(0, 4)}`;
}

/** The period (Monday–Sunday week, calendar month, calendar year) containing `anchor`. */
export function resolvePeriod(kind: PeriodKind, anchor: string): PeriodRange {
  if (kind === "monthly") {
    const month = anchor.slice(0, 7);
    return {
      kind,
      from: `${month}-01`,
      to: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
      label: monthLabel(month),
    };
  }
  if (kind === "yearly") {
    const year = anchor.slice(0, 4);
    return { kind, from: `${year}-01-01`, to: `${year}-12-31`, label: year };
  }
  const weekday = new Date(toUTC(anchor)).getUTCDay(); // 0 = Sunday
  const from = addDays(anchor, weekday === 0 ? -6 : 1 - weekday);
  const to = addDays(from, 6);
  return { kind, from, to, label: `Week of ${from}` };
}

/** Move a whole period forward or back. */
export function shiftPeriod(range: PeriodRange, delta: number): PeriodRange {
  if (range.kind === "weekly") return resolvePeriod("weekly", addDays(range.from, delta * 7));
  if (range.kind === "yearly")
    return resolvePeriod("yearly", `${Number(range.from.slice(0, 4)) + delta}-06-15`);
  const month = Number(range.from.slice(5, 7)) - 1 + delta;
  const year = Number(range.from.slice(0, 4)) + Math.floor(month / 12);
  const norm = ((month % 12) + 12) % 12;
  return resolvePeriod("monthly", `${year}-${String(norm + 1).padStart(2, "0")}-01`);
}

/** The comparable period one year earlier (weeks keep their weekday alignment). */
export function previousYearPeriod(range: PeriodRange): PeriodRange {
  if (range.kind === "weekly") return resolvePeriod("weekly", addDays(range.from, -364));
  return shiftPeriod(range, range.kind === "yearly" ? -1 : -12);
}

export interface NumbersRow {
  business_date: string;
  scope: string;
  sales: number | null;
  gross_profit: number | null;
  tires_sold: number | null;
  car_count: number | null;
  created_at?: string;
}

export interface PeriodValues {
  sales: number | null;
  gross_profit: number | null;
  tires_sold: number | null;
  car_count: number | null;
  gp_percent: number | null;
  basis: "cumulative-snapshot" | "monthly-rollup" | "daily-sum" | "none";
  as_of: string | null;
  covered_days: number;
}

const SUMMED = ["sales", "gross_profit", "tires_sold", "car_count"] as const;

function newest(rows: NumbersRow[]): NumbersRow | undefined {
  return [...rows].sort((a, b) =>
    a.business_date === b.business_date
      ? (a.created_at ?? "") < (b.created_at ?? "")
        ? 1
        : -1
      : a.business_date < b.business_date
        ? 1
        : -1,
  )[0];
}

/** Newest `daily` record per business date. */
function newestPerDate(rows: NumbersRow[]): NumbersRow[] {
  const byDate = new Map<string, NumbersRow>();
  for (const r of rows.filter((row) => row.scope === "daily")) {
    const existing = byDate.get(r.business_date);
    if (!existing || (r.created_at ?? "") >= (existing.created_at ?? ""))
      byDate.set(r.business_date, r);
  }
  return [...byDate.values()];
}

/** Sums each metric, keeping a metric null when no row reported it. */
function sumFields(rows: NumbersRow[]): Record<(typeof SUMMED)[number], number | null> {
  const sums: Record<(typeof SUMMED)[number], number | null> = {
    sales: null,
    gross_profit: null,
    tires_sold: null,
    car_count: null,
  };
  for (const row of rows) {
    for (const field of SUMMED) {
      const value = row[field];
      if (value === null || value === undefined || !Number.isFinite(value)) continue;
      sums[field] = (sums[field] ?? 0) + value;
    }
  }
  return sums;
}

function withPercent(values: Omit<PeriodValues, "gp_percent">): PeriodValues {
  const { sales, gross_profit } = values;
  const gp_percent =
    sales !== null && gross_profit !== null && sales > 0 ? (gross_profit / sales) * 100 : null;
  return { ...values, gp_percent };
}

/**
 * Actual stored numbers for a period. A confirmed month-to-date / year-to-date
 * snapshot covering the period wins; otherwise the daily records are summed.
 * `upTo` (the shop's business day) keeps future-dated records out.
 */
export function aggregatePeriod(
  rows: NumbersRow[],
  range: PeriodRange,
  upTo?: string,
): PeriodValues {
  const boundary = upTo && upTo < range.to ? upTo : range.to;
  const inRange = rows.filter((r) => r.business_date >= range.from && r.business_date <= boundary);

  const cumulativeScope = range.kind === "monthly" ? "mtd" : range.kind === "yearly" ? "ytd" : null;
  if (cumulativeScope) {
    const snapshot = newest(inRange.filter((r) => r.scope === cumulativeScope));
    if (snapshot) {
      return withPercent({
        sales: snapshot.sales,
        gross_profit: snapshot.gross_profit,
        tires_sold: snapshot.tires_sold,
        car_count: snapshot.car_count,
        basis: "cumulative-snapshot",
        as_of: snapshot.business_date,
        covered_days: 1,
      });
    }
  }

  // A year with accepted monthly totals is rolled up from those months. Months
  // without a monthly record fall back to their daily records, so the current
  // (incomplete) month is included once and never counted twice.
  if (range.kind === "yearly") {
    const months = Array.from(new Set(inRange.map((r) => r.business_date.slice(0, 7)))).sort();
    const monthSnapshots = months
      .map((month) =>
        newest(inRange.filter((r) => r.business_date.startsWith(month) && r.scope === "mtd")),
      )
      .filter((r): r is NumbersRow => Boolean(r));
    if (monthSnapshots.length > 0) {
      const covered = new Set(monthSnapshots.map((r) => r.business_date.slice(0, 7)));
      const dailyRows = newestPerDate(
        inRange.filter((r) => !covered.has(r.business_date.slice(0, 7))),
      );
      const used = [...monthSnapshots, ...dailyRows];
      const dates = used.map((r) => r.business_date).sort();
      return withPercent({
        ...sumFields(used),
        basis: "monthly-rollup",
        as_of: dates[dates.length - 1] ?? null,
        covered_days: used.length,
      });
    }
  }

  const byDate = new Map<string, NumbersRow>(
    newestPerDate(inRange).map((r) => [r.business_date, r]),
  );
  if (byDate.size === 0) {
    return withPercent({
      sales: null,
      gross_profit: null,
      tires_sold: null,
      car_count: null,
      basis: "none",
      as_of: null,
      covered_days: 0,
    });
  }

  const dates = [...byDate.keys()].sort();
  return withPercent({
    ...sumFields([...byDate.values()]),
    basis: "daily-sum",
    as_of: dates[dates.length - 1] ?? null,
    covered_days: byDate.size,
  });
}

/* ---------------------------------- goals --------------------------------- */

export type GoalMethod = "fixed" | "growth";

export interface GoalRule {
  method: GoalMethod;
  /** Fixed monthly target. */
  monthly?: number | null;
  /** Fixed yearly target. */
  yearly?: number | null;
  /** Growth over the comparable previous-year period, in percent. */
  growth_pct?: number | null;
}

export type GoalRules = Record<string, GoalRule>;

export type MetricFormat = "currency" | "count" | "percent";

export interface MetricDef {
  key: string;
  label: string;
  format: MetricFormat;
  /** True when a monthly/yearly goal can be divided down to a shorter period. */
  prorate: boolean;
}

export const NUMBER_METRICS: MetricDef[] = [
  { key: "sales", label: "Sales", format: "currency", prorate: true },
  { key: "gross_profit", label: "Gross profit", format: "currency", prorate: true },
  { key: "gp_percent", label: "Gross profit %", format: "percent", prorate: false },
  { key: "car_count", label: "Cars", format: "count", prorate: true },
  { key: "tires_sold", label: "Tires", format: "count", prorate: true },
  {
    key: "mechanic_productivity",
    label: "Mechanic productivity",
    format: "percent",
    prorate: false,
  },
];

export function productivityMetric(technician: string): MetricDef {
  return {
    key: `productivity:${technician}`,
    label: `${technician} productivity %`,
    format: "percent",
    prorate: false,
  };
}

/** The goal for one metric in one period, derived from the saved rule. */
export function goalFor(
  def: MetricDef,
  rule: GoalRule | undefined,
  range: PeriodRange,
  previousYearValue: number | null,
): number | null {
  if (!rule) return null;
  if (rule.method === "growth") {
    const pct = rule.growth_pct;
    if (pct === null || pct === undefined || previousYearValue === null) return null;
    return previousYearValue * (1 + pct / 100);
  }
  const monthly = rule.monthly ?? null;
  const yearly = rule.yearly ?? null;
  if (range.kind === "yearly") {
    if (yearly !== null) return yearly;
    if (monthly === null) return null;
    return def.prorate ? monthly * 12 : monthly;
  }
  if (range.kind === "monthly") {
    if (monthly !== null) return monthly;
    if (yearly === null) return null;
    return def.prorate ? yearly / 12 : yearly;
  }
  // Weekly goals are derived rather than typed in for every week.
  const base = monthly ?? (yearly === null ? null : def.prorate ? yearly / 12 : yearly);
  if (base === null) return null;
  if (!def.prorate) return base;
  return (base * 7) / daysInMonth(range.from.slice(0, 7));
}

/* ---------------------------------- report -------------------------------- */

export interface ReportRow {
  key: string;
  label: string;
  format: MetricFormat;
  actual: number | null;
  goal: number | null;
  variance: number | null;
  /** Percent difference to goal; null when the goal is 0/unknown or the metric is a percentage. */
  variance_pct: number | null;
  previous: number | null;
  yoy_diff: number | null;
  yoy_pct: number | null;
  /** True when a manual correction touched this metric inside the period. */
  adjusted: boolean;
}

export function buildReportRow(
  def: MetricDef,
  actual: number | null,
  goal: number | null,
  previous: number | null,
  adjusted = false,
): ReportRow {
  const variance = actual === null || goal === null ? null : actual - goal;
  const variance_pct =
    variance === null || goal === null || goal === 0 || def.format === "percent"
      ? null
      : (variance / goal) * 100;
  const yoy_diff = actual === null || previous === null ? null : actual - previous;
  const yoy_pct =
    yoy_diff === null || previous === null || previous === 0 || def.format === "percent"
      ? null
      : (yoy_diff / previous) * 100;
  return {
    key: def.key,
    label: def.label,
    format: def.format,
    actual,
    goal,
    variance,
    variance_pct,
    previous,
    yoy_diff,
    yoy_pct,
    adjusted,
  };
}

/* -------------------------------- formatting ------------------------------ */

export function formatMetric(value: number | null, format: MetricFormat): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (format === "currency")
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  if (format === "percent") return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString("en-US");
}

/** Signed difference. Percentage metrics are expressed in percentage points. */
export function formatDiff(value: number | null, format: MetricFormat): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (format === "percent") return `${sign}${abs.toFixed(1)} pts`;
  if (format === "currency")
    return `${sign}${abs.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
  return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
}

export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}
