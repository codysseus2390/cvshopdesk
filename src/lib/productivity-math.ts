import type { PeriodKind, PeriodRange } from "./numbers-math";

export const SHOP_PRODUCTIVITY_TECHNICIAN = "__shop_overall__";

export interface ProductivityInput {
  business_date: string;
  technician: string;
  productivity_pct: number | null;
  hours_billed: number | null;
  hours_worked: number | null;
  period_scope: string | null;
  updated_at?: string;
}

/**
 * Overall shop productivity for a reporting period. An accepted shop-level
 * period value wins; otherwise total billed hours / total worked hours is used.
 * Individual percentages are never averaged.
 */
export function overallProductivity(
  rows: ProductivityInput[],
  range: Pick<PeriodRange, "from" | "to">,
  kind: PeriodKind | "daily",
  upTo?: string,
): number | null {
  const boundary = upTo && upTo < range.to ? upTo : range.to;
  const inRange = rows.filter((row) => row.business_date >= range.from && row.business_date <= boundary);
  const overrides = inRange
    .filter(
      (row) =>
        row.technician === SHOP_PRODUCTIVITY_TECHNICIAN &&
        row.productivity_pct !== null &&
        (kind === "daily" ? !row.period_scope : row.period_scope === kind),
    )
    .sort((a, b) =>
      a.business_date === b.business_date
        ? (a.updated_at ?? "") < (b.updated_at ?? "")
          ? 1
          : -1
        : a.business_date < b.business_date
          ? 1
          : -1,
    );
  if (overrides[0]) return Number(overrides[0].productivity_pct);

  const inputs = inRange.filter(
    (row) =>
      row.technician !== SHOP_PRODUCTIVITY_TECHNICIAN &&
      !row.period_scope &&
      row.hours_billed !== null &&
      row.hours_worked !== null &&
      Number.isFinite(Number(row.hours_billed)) &&
      Number.isFinite(Number(row.hours_worked)),
  );
  if (inputs.length === 0) return null;
  const billed = inputs.reduce((sum, row) => sum + Number(row.hours_billed), 0);
  const worked = inputs.reduce((sum, row) => sum + Number(row.hours_worked), 0);
  return worked > 0 ? (billed / worked) * 100 : null;
}

export function formatProductivity(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}