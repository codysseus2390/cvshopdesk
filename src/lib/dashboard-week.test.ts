import { describe, expect, it } from "vitest";
import { dashboardWeekFromReport, formatDashboardWeekRange, weeklyGoalNote } from "./dashboard-week";
import type { NumbersReport } from "./numbers.server";

function report(cars: number | null): NumbersReport {
  return {
    kind: "weekly",
    range: { kind: "weekly", from: "2026-09-14", to: "2026-09-20", label: "Week of 2026-09-14" },
    previousRange: { kind: "weekly", from: "2025-09-15", to: "2025-09-21", label: "Week of 2025-09-15" },
    shopToday: "2026-09-16",
    basis: "daily-sum",
    as_of: "2026-09-16",
    covered_days: 3,
    rows: [
      { key: "gross_profit", label: "Gross profit", format: "currency", actual: 12_000, goal: 15_000, variance: -3_000, variance_pct: -20, previous: null, yoy_diff: null, yoy_pct: null, adjusted: false },
      { key: "tires_sold", label: "Tires", format: "count", actual: 42, goal: 50, variance: -8, variance_pct: -16, previous: null, yoy_diff: null, yoy_pct: null, adjusted: false },
      { key: "car_count", label: "Cars", format: "count", actual: cars, goal: null, variance: null, variance_pct: null, previous: null, yoy_diff: null, yoy_pct: null, adjusted: false },
    ],
    technicians: [],
    goal_rules: {},
    corrections: [],
  };
}

describe("dashboard weekly cards", () => {
  it("uses weekly report totals and derives GP per car from aggregate GP and cars", () => {
    expect(dashboardWeekFromReport(report(60))).toMatchObject({
      from: "2026-09-14",
      through: "2026-09-16",
      gross_profit: 12_000,
      tires_sold: 42,
      car_count: 60,
      gp_per_car: 200,
      goals: { gross_profit: 15_000, tires_sold: 50, car_count: null },
    });
  });

  it("keeps GP per car unavailable when weekly cars are zero or missing", () => {
    expect(dashboardWeekFromReport(report(0)).gp_per_car).toBeNull();
    expect(dashboardWeekFromReport(report(null)).gp_per_car).toBeNull();
  });

  it("shows progress only for configured positive goals", () => {
    expect(weeklyGoalNote(12_000, 15_000)).toBe("80% of weekly goal");
    expect(weeklyGoalNote(12_000, null)).toBeUndefined();
  });

  it("formats the represented accepted date range", () => {
    expect(formatDashboardWeekRange("2026-09-14", "2026-09-16")).toBe("Sep 14 – 16, 2026");
  });
});