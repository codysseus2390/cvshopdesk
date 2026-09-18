/**
 * Pure metric math for Cedar Valley Hub.
 * Rules enforced here:
 *  - Missing values stay null ("Not updated"); a verified 0 is a real value.
 *  - A missing per-field value is never treated as zero: each metric tracks its own coverage.
 *  - Gross profit per car = gross profit total / car count total over the SAME complete records.
 *    If gross profit and car count do not cover the same days, GP/car is unavailable.
 *  - Daily / MTD / YTD scopes never mix. Cumulative snapshots are replacements, not addends.
 *  - Nothing dated after the shop's current business day is counted in current results.
 */

export type Scope = "daily" | "mtd" | "ytd" | "invoice" | "inventory" | "jobs" | "other";

export interface MetricRow {
  business_date: string; // YYYY-MM-DD
  scope: Scope;
  gross_profit: number | null;
  tires_sold: number | null;
  car_count: number | null;
  created_at?: string;
}

export interface FieldCoverage {
  /** Days inside the window that have a saved value for this metric. */
  days_with_value: number;
  /** Days that have a saved record but no value for this metric. */
  days_missing_value: number;
}

export interface Totals {
  gross_profit: number | null;
  tires_sold: number | null;
  car_count: number | null;
  gp_per_car: number | null;
  /** Plain-language reason GP/car is unavailable, or a partial-coverage caveat. */
  gp_per_car_note: string | null;
  /** Days in the window with at least one saved record. */
  covered_days: number;
  /** Days in the window with no saved record at all. */
  missing_days: number;
  coverage: {
    gross_profit: FieldCoverage;
    tires_sold: FieldCoverage;
    car_count: FieldCoverage;
  };
}

export function gpPerCar(grossProfit: number | null, carCount: number | null): number | null {
  if (grossProfit === null || carCount === null) return null;
  if (!Number.isFinite(grossProfit) || !Number.isFinite(carCount)) return null;
  if (carCount <= 0) return null;
  return grossProfit / carCount;
}

const FIELDS = ["gross_profit", "tires_sold", "car_count"] as const;
type Field = (typeof FIELDS)[number];

function emptyTotals(expectedDays: number): Totals {
  const none: FieldCoverage = { days_with_value: 0, days_missing_value: 0 };
  return {
    gross_profit: null,
    tires_sold: null,
    car_count: null,
    gp_per_car: null,
    gp_per_car_note: "No confirmed records for this period",
    covered_days: 0,
    missing_days: Math.max(0, expectedDays),
    coverage: { gross_profit: { ...none }, tires_sold: { ...none }, car_count: { ...none } },
  };
}

/**
 * Sum of daily-scope rows only. Cumulative rows are ignored on purpose.
 * `upTo` (the shop's current business date) excludes future-dated records.
 */
export function sumDaily(rows: MetricRow[], expectedDays: number, upTo?: string): Totals {
  const daily = rows.filter(
    (r) => r.scope === "daily" && (upTo === undefined || r.business_date <= upTo),
  );
  // One record per business date: the newest current snapshot wins.
  const byDate = new Map<string, MetricRow>();
  for (const r of daily) {
    const existing = byDate.get(r.business_date);
    if (!existing || (r.created_at ?? "") >= (existing.created_at ?? ""))
      byDate.set(r.business_date, r);
  }
  if (byDate.size === 0) return emptyTotals(expectedDays);

  const sums: Record<Field, number | null> = {
    gross_profit: null,
    tires_sold: null,
    car_count: null,
  };
  const withValue: Record<Field, Set<string>> = {
    gross_profit: new Set(),
    tires_sold: new Set(),
    car_count: new Set(),
  };

  for (const [date, row] of byDate) {
    for (const f of FIELDS) {
      const v = row[f];
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      withValue[f].add(date);
      sums[f] = (sums[f] ?? 0) + v;
    }
  }

  const coveredDays = byDate.size;
  const missingDays = Math.max(0, expectedDays - coveredDays);
  const coverage = {
    gross_profit: cov(withValue.gross_profit.size, coveredDays),
    tires_sold: cov(withValue.tires_sold.size, coveredDays),
    car_count: cov(withValue.car_count.size, coveredDays),
  };

  const { value, note } = ratio({
    grossProfit: sums.gross_profit,
    carCount: sums.car_count,
    gpDays: withValue.gross_profit,
    carDays: withValue.car_count,
    coveredDays,
    missingDays,
  });

  return {
    gross_profit: sums.gross_profit,
    tires_sold: sums.tires_sold,
    car_count: sums.car_count,
    gp_per_car: value,
    gp_per_car_note: note,
    covered_days: coveredDays,
    missing_days: missingDays,
    coverage,
  };
}

function cov(withValue: number, coveredDays: number): FieldCoverage {
  return { days_with_value: withValue, days_missing_value: Math.max(0, coveredDays - withValue) };
}

function ratio(args: {
  grossProfit: number | null;
  carCount: number | null;
  gpDays: Set<string>;
  carDays: Set<string>;
  coveredDays: number;
  missingDays: number;
}): { value: number | null; note: string | null } {
  const { grossProfit, carCount, gpDays, carDays, coveredDays, missingDays } = args;
  if (gpDays.size === 0 || carDays.size === 0) {
    return { value: null, note: "Needs both gross profit and car count" };
  }
  if (gpDays.size !== coveredDays || carDays.size !== coveredDays) {
    return {
      value: null,
      note: `Unavailable: gross profit saved for ${gpDays.size} of ${coveredDays} day(s), car count for ${carDays.size} of ${coveredDays}`,
    };
  }
  // Same days on both metrics — safe to divide.
  const value = gpPerCar(grossProfit, carCount);
  if (value === null) return { value: null, note: "Car count is zero or unknown for this period" };
  if (missingDays > 0) {
    return {
      value,
      note: `Based on ${coveredDays} saved day(s); ${missingDays} day(s) still missing`,
    };
  }
  return { value, note: null };
}

/** Totals taken straight from one cumulative (mtd/ytd) snapshot. */
function fromSnapshot(row: MetricRow, elapsedSinceAsOf: number): Totals {
  const gpDays = row.gross_profit === null ? new Set<string>() : new Set([row.business_date]);
  const carDays = row.car_count === null ? new Set<string>() : new Set([row.business_date]);
  const { value, note } = ratio({
    grossProfit: row.gross_profit,
    carCount: row.car_count,
    gpDays,
    carDays,
    coveredDays: 1,
    missingDays: 0,
  });
  return {
    gross_profit: row.gross_profit,
    tires_sold: row.tires_sold,
    car_count: row.car_count,
    gp_per_car: value,
    gp_per_car_note: note,
    covered_days: 1,
    missing_days: Math.max(0, elapsedSinceAsOf),
    coverage: {
      gross_profit: cov(gpDays.size, 1),
      tires_sold: cov(row.tires_sold === null ? 0 : 1, 1),
      car_count: cov(carDays.size, 1),
    },
  };
}

export interface PeriodTotals extends Totals {
  basis: "cumulative-snapshot" | "daily-sum" | "none";
  /** Business date the numbers actually describe. */
  as_of: string | null;
  /** True when the newest record is older than the shop's current business day. */
  stale: boolean;
  /** Days between as_of and the shop's business day that are not represented. */
  days_behind: number;
}

/** How many days of a month have happened as of `today` (0 for future months). */
export function daysElapsedInMonth(monthPrefix: string, today: string): number {
  const todayMonth = today.slice(0, 7);
  if (monthPrefix > todayMonth) return 0;
  if (monthPrefix === todayMonth) return Number(today.slice(8, 10));
  return daysInMonth(monthPrefix);
}

export function daysInMonth(monthPrefix: string): number {
  const year = Number(monthPrefix.slice(0, 4));
  const month = Number(monthPrefix.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 1-based day of the year for a YYYY-MM-DD date. */
export function dayOfYear(date: string): number {
  const start = Date.UTC(Number(date.slice(0, 4)), 0, 1);
  const day = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  return Math.round((day - start) / 86_400_000) + 1;
}

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function latestCumulative(
  rows: MetricRow[],
  scope: "mtd" | "ytd",
  upTo: string,
): MetricRow | undefined {
  return rows
    .filter((r) => r.scope === scope && r.business_date <= upTo)
    .sort((a, b) =>
      a.business_date === b.business_date
        ? (a.created_at ?? "") < (b.created_at ?? "")
          ? 1
          : -1
        : a.business_date < b.business_date
          ? 1
          : -1,
    )[0];
}

/**
 * Month-to-date result as of the shop's business day `today`.
 * The latest accepted cumulative `mtd` snapshot replaces the daily sum, but its own
 * as-of date is reported and coverage is marked stale when it predates today.
 */
export function monthToDate(rows: MetricRow[], monthPrefix: string, today: string): PeriodTotals {
  const elapsed = daysElapsedInMonth(monthPrefix, today);
  const boundary = monthPrefix === today.slice(0, 7) ? today : `${monthPrefix}-31`;
  const inMonth = rows.filter((r) => r.business_date.startsWith(monthPrefix));
  const snapshot = latestCumulative(inMonth, "mtd", boundary);

  if (snapshot) {
    const behind = daysBetween(snapshot.business_date, boundary);
    return {
      ...fromSnapshot(snapshot, behind),
      basis: "cumulative-snapshot",
      as_of: snapshot.business_date,
      stale: behind > 0,
      days_behind: behind,
    };
  }

  const summed = sumDaily(inMonth, elapsed, boundary);
  const dailyDates = inMonth
    .filter((r) => r.scope === "daily" && r.business_date <= boundary)
    .map((r) => r.business_date)
    .sort();
  const asOf = dailyDates.length ? dailyDates[dailyDates.length - 1]! : null;
  const behind = asOf ? daysBetween(asOf, boundary) : elapsed;
  return {
    ...summed,
    basis: summed.covered_days > 0 ? "daily-sum" : "none",
    as_of: asOf,
    stale: behind > 0,
    days_behind: behind,
  };
}

/**
 * Year-to-date result. A confirmed cumulative `ytd` snapshot is respected (latest wins);
 * otherwise daily rows in the year are summed against elapsed days of the year.
 * Cumulative and daily scopes are never added together.
 */
export function yearToDate(rows: MetricRow[], year: string, today: string): PeriodTotals {
  const inYear = rows.filter((r) => r.business_date.startsWith(year));
  const boundary = year === today.slice(0, 4) ? today : `${year}-12-31`;
  const elapsed = year === today.slice(0, 4) ? dayOfYear(today) : dayOfYear(`${year}-12-31`);
  const snapshot = latestCumulative(inYear, "ytd", boundary);

  if (snapshot) {
    const behind = daysBetween(snapshot.business_date, boundary);
    return {
      ...fromSnapshot(snapshot, behind),
      basis: "cumulative-snapshot",
      as_of: snapshot.business_date,
      stale: behind > 0,
      days_behind: behind,
    };
  }

  // Accepted monthly totals are rolled up; months without one fall back to their
  // daily records, so the current incomplete month is counted exactly once.
  const months = Array.from(new Set(inYear.map((r) => r.business_date.slice(0, 7)))).sort();
  const monthlyRows = months
    .map((month) =>
      latestCumulative(
        inYear.filter((r) => r.business_date.startsWith(month)),
        "mtd",
        boundary,
      ),
    )
    .filter((r): r is MetricRow => Boolean(r));
  if (monthlyRows.length > 0) {
    const covered = new Set(monthlyRows.map((r) => r.business_date.slice(0, 7)));
    const dailyRest = inYear.filter(
      (r) => r.scope === "daily" && !covered.has(r.business_date.slice(0, 7)),
    );
    const asDaily: MetricRow[] = [
      ...monthlyRows.map((r) => ({ ...r, scope: "daily" as const })),
      ...dailyRest,
    ];
    const rolled = sumDaily(asDaily, asDaily.length, boundary);
    const dates = asDaily.map((r) => r.business_date).sort();
    const asOfRolled = dates[dates.length - 1] ?? null;
    const behindRolled = asOfRolled ? daysBetween(asOfRolled, boundary) : elapsed;
    return {
      ...rolled,
      basis: "cumulative-snapshot",
      as_of: asOfRolled,
      stale: behindRolled > 0,
      days_behind: behindRolled,
    };
  }

  const summed = sumDaily(inYear, elapsed, boundary);
  const dailyDates = inYear
    .filter((r) => r.scope === "daily" && r.business_date <= boundary)
    .map((r) => r.business_date)
    .sort();
  const asOf = dailyDates.length ? dailyDates[dailyDates.length - 1]! : null;
  const behind = asOf ? daysBetween(asOf, boundary) : elapsed;
  return {
    ...summed,
    basis: summed.covered_days > 0 ? "daily-sum" : "none",
    as_of: asOf,
    stale: behind > 0,
    days_behind: behind,
  };
}

/** Keeps only the most recent snapshot per (date, scope) — used for client-side lists. */
export function latestPerDateScope<T extends MetricRow & { created_at?: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const key = `${r.business_date}|${r.scope}`;
    const existing = map.get(key);
    if (!existing || (r.created_at ?? "") > (existing.created_at ?? "")) map.set(key, r);
  }
  return [...map.values()].sort((a, b) => (a.business_date < b.business_date ? 1 : -1));
}

export function formatCurrency(value: number | null): string {
  if (value === null) return "Not updated";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatCount(value: number | null): string {
  if (value === null) return "Not updated";
  return value.toLocaleString("en-US");
}

/** Business date in the shop's timezone (America/Chicago). */
export function shopToday(timeZone = "America/Chicago", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
