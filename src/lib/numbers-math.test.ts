import { describe, expect, it } from "vitest";
import {
  aggregatePeriod,
  buildReportRow,
  goalFor,
  previousYearPeriod,
  resolvePeriod,
  shiftPeriod,
  NUMBER_METRICS,
  type NumbersRow,
} from "./numbers-math";

const salesDef = NUMBER_METRICS[0]!;
const gpPercentDef = NUMBER_METRICS[2]!;

const daily = (business_date: string, sales: number | null, gp: number | null): NumbersRow => ({
  business_date,
  scope: "daily",
  sales,
  gross_profit: gp,
  tires_sold: 10,
  car_count: 5,
});

describe("periods", () => {
  it("resolves a Monday-start week", () => {
    const week = resolvePeriod("weekly", "2026-09-16"); // Wednesday
    expect(week.from).toBe("2026-09-14");
    expect(week.to).toBe("2026-09-20");
  });

  it("resolves months and years", () => {
    expect(resolvePeriod("monthly", "2026-09-16")).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(resolvePeriod("yearly", "2026-09-16")).toMatchObject({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("shifts periods and finds the comparable period last year", () => {
    expect(shiftPeriod(resolvePeriod("monthly", "2026-01-10"), -1).from).toBe("2025-12-01");
    expect(previousYearPeriod(resolvePeriod("monthly", "2026-09-10")).from).toBe("2025-09-01");
    expect(previousYearPeriod(resolvePeriod("yearly", "2026-09-10")).from).toBe("2025-01-01");
    // Weeks keep their weekday alignment (52 weeks back).
    expect(previousYearPeriod(resolvePeriod("weekly", "2026-09-16")).from).toBe("2025-09-15");
  });
});

describe("aggregatePeriod", () => {
  const month = resolvePeriod("monthly", "2026-09-01");

  it("sums daily records and derives gross profit %", () => {
    const values = aggregatePeriod(
      [daily("2026-09-01", 1000, 400), daily("2026-09-02", 1000, 500)],
      month,
      "2026-09-30",
    );
    expect(values.sales).toBe(2000);
    expect(values.gross_profit).toBe(900);
    expect(values.gp_percent).toBe(45);
    expect(values.basis).toBe("daily-sum");
  });

  it("keeps missing values null instead of zero", () => {
    const values = aggregatePeriod([], month, "2026-09-30");
    expect(values.sales).toBeNull();
    expect(values.gp_percent).toBeNull();
    expect(values.basis).toBe("none");
  });

  it("lets a corrected month-to-date snapshot replace the daily sum", () => {
    const rows: NumbersRow[] = [
      daily("2026-09-01", 1000, 400),
      {
        business_date: "2026-09-30",
        scope: "mtd",
        sales: 50_000,
        gross_profit: 20_000,
        tires_sold: 300,
        car_count: 200,
        created_at: "2026-10-01T00:00:00Z",
      },
    ];
    const values = aggregatePeriod(rows, month, "2026-09-30");
    expect(values.sales).toBe(50_000);
    expect(values.basis).toBe("cumulative-snapshot");
  });
});

describe("goals", () => {
  const month = resolvePeriod("monthly", "2026-09-01");
  const week = resolvePeriod("weekly", "2026-09-16");

  it("uses a fixed monthly goal, and derives yearly and weekly goals from it", () => {
    const rule = { method: "fixed" as const, monthly: 100_000 };
    expect(goalFor(salesDef, rule, month, null)).toBe(100_000);
    expect(goalFor(salesDef, rule, resolvePeriod("yearly", "2026-01-01"), null)).toBe(1_200_000);
    expect(goalFor(salesDef, rule, week, null)).toBeCloseTo((100_000 * 7) / 30, 5);
  });

  it("calculates a growth goal from the comparable previous-year value", () => {
    expect(goalFor(salesDef, { method: "growth", growth_pct: 10 }, month, 90_000)!).toBeCloseTo(
      99_000,
      6,
    );
    expect(goalFor(salesDef, { method: "growth", growth_pct: 10 }, month, null)).toBeNull();
  });

  it("does not prorate percentage goals", () => {
    expect(goalFor(gpPercentDef, { method: "fixed", monthly: 45 }, week, null)).toBe(45);
  });
});

describe("buildReportRow", () => {
  it("reports variance and year-over-year change", () => {
    const row = buildReportRow(salesDef, 24_850, 25_000, 22_100);
    expect(row.variance).toBe(-150);
    expect(row.variance_pct).toBeCloseTo(-0.6, 3);
    expect(row.yoy_diff).toBe(2750);
    expect(row.yoy_pct).toBeCloseTo(12.44, 2);
  });

  it("gives no percentage when the base is zero or unknown, and uses points for percentages", () => {
    expect(buildReportRow(salesDef, 100, 0, 0).variance_pct).toBeNull();
    expect(buildReportRow(salesDef, 100, 0, 0).yoy_pct).toBeNull();
    expect(buildReportRow(gpPercentDef, 45, 42, 40).yoy_pct).toBeNull();
    expect(buildReportRow(gpPercentDef, 45, 42, 40).yoy_diff).toBe(5);
    expect(buildReportRow(salesDef, null, 100, null).variance).toBeNull();
  });
});

describe("yearly monthly rollup", () => {
  const year = resolvePeriod("yearly", "2026-03-10");

  it("adds accepted monthly totals and uses daily rows only for months without one", () => {
    const rows = [
      {
        business_date: "2026-01-31",
        scope: "mtd",
        sales: 90_000,
        gross_profit: 40_000,
        tires_sold: 100,
        car_count: 200,
        created_at: "2026-02-01",
      },
      {
        business_date: "2026-02-28",
        scope: "mtd",
        sales: 80_000,
        gross_profit: 30_000,
        tires_sold: 90,
        car_count: 180,
        created_at: "2026-03-01",
      },
      {
        business_date: "2026-03-02",
        scope: "daily",
        sales: 5_000,
        gross_profit: 2_000,
        tires_sold: 4,
        car_count: 9,
        created_at: "2026-03-02",
      },
      // Superseded January daily rows must not be added on top of the monthly total.
      {
        business_date: "2026-01-05",
        scope: "daily",
        sales: 3_000,
        gross_profit: 1_000,
        tires_sold: 3,
        car_count: 6,
        created_at: "2026-01-05",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;
    const totals = aggregatePeriod(rows, year, "2026-03-10");
    expect(totals.basis).toBe("monthly-rollup");
    expect(totals.sales).toBe(175_000);
    expect(totals.gross_profit).toBe(72_000);
    expect(totals.car_count).toBe(389);
    expect(totals.as_of).toBe("2026-03-02");
  });
});
