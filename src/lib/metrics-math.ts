/**
 * Pure metric math for Cedar Valley Hub.
 * Rules enforced here:
 *  - Missing values stay null ("Not updated"); a verified 0 is a real value.
 *  - Gross profit per car = gross profit total / car count total. Never an average of daily ratios.
 *  - Daily / MTD / YTD scopes never mix. Cumulative snapshots are replacements, not addends.
 */

export type Scope = "daily" | "mtd" | "ytd" | "invoice" | "inventory" | "jobs" | "other";

export interface MetricRow {
  business_date: string; // YYYY-MM-DD
  scope: Scope;
  gross_profit: number | null;
  tires_sold: number | null;
  car_count: number | null;
}

export interface Totals {
  gross_profit: number | null;
  tires_sold: number | null;
  car_count: number | null;
  gp_per_car: number | null;
  covered_days: number;
  /** Days in the requested window with no confirmed record at all. */
  missing_days: number;
}

export function gpPerCar(grossProfit: number | null, carCount: number | null): number | null {
  if (grossProfit === null || carCount === null) return null;
  if (!Number.isFinite(grossProfit) || !Number.isFinite(carCount)) return null;
  if (carCount <= 0) return null;
  return grossProfit / carCount;
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

/** Sum of daily-scope rows only. Cumulative rows are ignored on purpose. */
export function sumDaily(rows: MetricRow[], expectedDays: number): Totals {
  const daily = rows.filter((r) => r.scope === "daily");
  let gp: number | null = null;
  let tires: number | null = null;
  let cars: number | null = null;
  const dates = new Set<string>();
  for (const r of daily) {
    dates.add(r.business_date);
    gp = addNullable(gp, r.gross_profit);
    tires = addNullable(tires, r.tires_sold);
    cars = addNullable(cars, r.car_count);
  }
  return {
    gross_profit: gp,
    tires_sold: tires,
    car_count: cars,
    gp_per_car: gpPerCar(gp, cars),
    covered_days: dates.size,
    missing_days: Math.max(0, expectedDays - dates.size),
  };
}

/**
 * Month-to-date result. A confirmed cumulative `mtd` snapshot (the latest business
 * date in the month) replaces the daily sum; otherwise daily rows are summed.
 */
export function monthToDate(
  rows: MetricRow[],
  monthPrefix: string,
  daysElapsed: number,
): Totals & { basis: "cumulative-snapshot" | "daily-sum" | "none"; as_of: string | null } {
  const inMonth = rows.filter((r) => r.business_date.startsWith(monthPrefix));
  const mtdRows = inMonth
    .filter((r) => r.scope === "mtd")
    .sort((a, b) => (a.business_date < b.business_date ? 1 : -1));
  const latest = mtdRows[0];
  if (latest) {
    return {
      gross_profit: latest.gross_profit,
      tires_sold: latest.tires_sold,
      car_count: latest.car_count,
      gp_per_car: gpPerCar(latest.gross_profit, latest.car_count),
      covered_days: 1,
      missing_days: 0,
      basis: "cumulative-snapshot",
      as_of: latest.business_date,
    };
  }
  const summed = sumDaily(inMonth, daysElapsed);
  const dailyDates = inMonth
    .filter((r) => r.scope === "daily")
    .map((r) => r.business_date)
    .sort();
  return {
    ...summed,
    basis: summed.covered_days > 0 ? "daily-sum" : "none",
    as_of: dailyDates.length ? dailyDates[dailyDates.length - 1]! : null,
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
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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
