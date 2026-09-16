import { describe, expect, it } from "vitest";
import { buildDashboardChart, type DashboardChartMetric, type DashboardMonth } from "./dashboard-chart";

const totals = (value: number) => ({
  sales: value * 2,
  gross_profit: value,
  tires_sold: value / 100,
  car_count: value / 50,
  gp_per_car: value / (value / 50),
});

const months: DashboardMonth[] = [
  { month: "2025-09", totals: totals(30_000) },
  { month: "2026-01", totals: totals(40_000) },
  { month: "2026-08", totals: totals(50_000) },
  { month: "2026-09", totals: totals(21_918) },
];

describe("dashboard current-month chart treatment", () => {
  it("keeps completed months solid and moves the exact current value to the MTD point", () => {
    const chart = buildDashboardChart(months, "gross_profit", "2026-09-16");
    expect(chart?.rows[0]).toMatchObject({ month: "Jan", "2026": 40_000, "2026__mtd": null });
    expect(chart?.rows[7]).toMatchObject({ month: "Aug", "2026": 50_000, "2026__mtd": null });
    expect(chart?.rows[8]).toMatchObject({ month: "Sep", "2026": null, "2026__mtd": 21_918 });
    expect(chart?.rows[9]).toMatchObject({ month: "Oct", "2026": null, "2026__mtd": null });
  });

  it("leaves historical-year values in the normal solid series", () => {
    const chart = buildDashboardChart(months, "gross_profit", "2026-09-16");
    expect(chart?.rows[8]).toMatchObject({ "2025": 30_000, "2025__mtd": null });
  });

  it("automatically makes the prior month solid after the reporting period advances", () => {
    const chart = buildDashboardChart(months, "gross_profit", "2026-10-01");
    expect(chart?.rows[8]).toMatchObject({ "2026": 21_918, "2026__mtd": null });
  });

  it.each<DashboardChartMetric>([
    "gross_profit",
    "sales",
    "tires_sold",
    "car_count",
    "gross_profit_per_car",
  ])("applies the current-month split to %s", (metric) => {
    const chart = buildDashboardChart(months, metric, "2026-09-16");
    expect(chart?.rows[8]?.["2026"]).toBeNull();
    expect(chart?.rows[8]?.["2026__mtd"]).not.toBeNull();
  });
});