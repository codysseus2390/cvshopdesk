export type DashboardChartMetric =
  "gross_profit" | "sales" | "gross_profit_per_car" | "tires_sold" | "car_count";

export interface DashboardMonth {
  month: string;
  totals: {
    sales: number | null;
    gross_profit: number | null;
    tires_sold: number | null;
    car_count: number | null;
    gp_per_car: number | null;
  };
}

export type DashboardChartRow = Record<string, number | string | null> & {
  month: string;
  monthKey: string;
};

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/** Comparable completed monthly values only; never compare daily, weekly and MTD totals as a trend. */
export function buildDashboardSparkline(
  monthly: DashboardMonth[],
  metric: DashboardChartMetric,
  shopToday: string,
): { year: string; points: { month: string; value: number | null }[] } | null {
  const currentMonth = shopToday.slice(0, 7);
  const completed = monthly.filter(
    (entry) =>
      /^\d{4}-(0[1-9]|1[0-2])$/.test(entry.month) &&
      entry.month < currentMonth &&
      metricValue(entry, metric) !== null,
  );
  const year = completed
    .map((entry) => entry.month.slice(0, 4))
    .sort()
    .at(-1);
  if (!year) return null;
  const latestMonth = completed
    .filter((entry) => entry.month.startsWith(`${year}-`))
    .map((entry) => entry.month)
    .sort()
    .at(-1)!;
  const points = MONTHS.filter((month) => `${year}-${month}` <= latestMonth).map((month) => ({
    month: `${year}-${month}`,
    value: metricValue(
      monthly.find((entry) => entry.month === `${year}-${month}`),
      metric,
    ),
  }));
  return { year, points };
}

function metricValue(
  month: DashboardMonth | undefined,
  metric: DashboardChartMetric,
): number | null {
  if (!month) return null;
  const value = metric === "gross_profit_per_car" ? month.totals.gp_per_car : month.totals[metric];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Builds January–December chart rows from the same monthly records used by Numbers.
 * The current shop month is removed from the solid series and exposed separately as MTD.
 */
export function buildDashboardChart(
  monthly: DashboardMonth[],
  metric: DashboardChartMetric,
  shopToday: string,
): {
  years: string[];
  rows: DashboardChartRow[];
  currentYear: string;
  currentMonth: string;
} | null {
  const available = monthly.filter(
    (entry) => /^\d{4}-(0[1-9]|1[0-2])$/.test(entry.month) && entry.month <= shopToday.slice(0, 7),
  );
  if (available.length === 0) return null;

  const currentYear = shopToday.slice(0, 4);
  const currentMonth = shopToday.slice(0, 7);
  const years = Array.from(new Set(available.map((entry) => entry.month.slice(0, 4)))).sort();
  const rows = MONTHS.map((monthNumber) => {
    const monthKey = `${currentYear}-${monthNumber}`;
    const label = new Date(`2000-${monthNumber}-01T00:00:00Z`).toLocaleString(undefined, {
      timeZone: "UTC",
      month: "short",
    });
    const row: DashboardChartRow = { month: label, monthKey };

    for (const year of years) {
      const recordKey = `${year}-${monthNumber}`;
      const value = metricValue(
        available.find((entry) => entry.month === recordKey),
        metric,
      );
      const isCurrentIncompleteMonth = year === currentYear && recordKey === currentMonth;
      row[year] = isCurrentIncompleteMonth ? null : value;
      row[`${year}__mtd`] = isCurrentIncompleteMonth ? value : null;
    }

    return row;
  });

  return { years, rows, currentYear, currentMonth };
}
