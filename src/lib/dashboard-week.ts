import type { NumbersReport } from "./numbers.server";

export interface DashboardWeek {
  from: string;
  through: string;
  gross_profit: number | null;
  tires_sold: number | null;
  car_count: number | null;
  gp_per_car: number | null;
  goals: Record<"gross_profit" | "tires_sold" | "car_count", number | null>;
}

/** Projects the shared weekly Numbers report into the four dashboard cards. */
export function dashboardWeekFromReport(report: NumbersReport): DashboardWeek {
  const row = (key: string) => report.rows.find((entry) => entry.key === key);
  const grossProfit = row("gross_profit")?.actual ?? null;
  const tiresSold = row("tires_sold")?.actual ?? null;
  const carCount = row("car_count")?.actual ?? null;

  return {
    from: report.range.from,
    through: report.as_of ?? (report.shopToday < report.range.to ? report.shopToday : report.range.to),
    gross_profit: grossProfit,
    tires_sold: tiresSold,
    car_count: carCount,
    gp_per_car: grossProfit !== null && carCount !== null && carCount > 0 ? grossProfit / carCount : null,
    goals: {
      gross_profit: row("gross_profit")?.goal ?? null,
      tires_sold: row("tires_sold")?.goal ?? null,
      car_count: row("car_count")?.goal ?? null,
    },
  };
}

export function weeklyGoalNote(actual: number | null, goal: number | null): string | undefined {
  if (actual === null || goal === null || goal <= 0) return undefined;
  return `${Math.round((actual / goal) * 100)}% of weekly goal`;
}

export function formatDashboardWeekRange(from: string, through: string): string {
  const monthName = (date: string) =>
    new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
    });
  const sameYear = from.slice(0, 4) === through.slice(0, 4);
  const sameMonth = from.slice(0, 7) === through.slice(0, 7);
  const startLabel = `${monthName(from)} ${Number(from.slice(8, 10))}${sameYear ? "" : `, ${from.slice(0, 4)}`}`;
  const endLabel = `${sameMonth ? "" : `${monthName(through)} `}${Number(through.slice(8, 10))}, ${through.slice(0, 4)}`;
  return `${startLabel} – ${endLabel}`;
}