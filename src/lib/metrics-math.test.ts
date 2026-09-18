import { describe, expect, it } from "vitest";
import {
  dayOfYear,
  formatCount,
  formatCurrency,
  gpPerCar,
  monthToDate,
  sumDaily,
  yearToDate,
  type MetricRow,
} from "./metrics-math";
import { JOB_ROWS_PER_PAGE, SCREEN_SECONDS, screenAt } from "@/routes/_authenticated/tv";

const daily = (
  date: string,
  gp: number | null,
  tires: number | null,
  cars: number | null,
): MetricRow => ({
  business_date: date,
  scope: "daily",
  gross_profit: gp,
  tires_sold: tires,
  car_count: cars,
});

describe("gp per car", () => {
  it("divides period totals, never averages daily ratios", () => {
    expect(gpPerCar(1000, 8)).toBe(125);
  });
  it("is unavailable when the denominator is zero or unknown", () => {
    expect(gpPerCar(1000, 0)).toBeNull();
    expect(gpPerCar(1000, null)).toBeNull();
    expect(gpPerCar(null, 4)).toBeNull();
  });
});

describe("daily totals", () => {
  it("sums only daily rows and ignores cumulative rows", () => {
    const rows: MetricRow[] = [
      daily("2026-03-01", 1000, 4, 5),
      daily("2026-03-02", 500, 2, 5),
      {
        business_date: "2026-03-02",
        scope: "mtd",
        gross_profit: 1500,
        tires_sold: 6,
        car_count: 10,
      },
    ];
    const totals = sumDaily(rows, 2);
    expect(totals.gross_profit).toBe(1500);
    expect(totals.car_count).toBe(10);
    expect(totals.gp_per_car).toBe(150);
    expect(totals.gp_per_car_note).toBeNull();
    expect(totals.covered_days).toBe(2);
    expect(totals.missing_days).toBe(0);
  });

  it("reports missing coverage instead of assuming zero", () => {
    const totals = sumDaily([daily("2026-03-01", 1000, 4, 5)], 5);
    expect(totals.missing_days).toBe(4);
    expect(formatCurrency(null)).toBe("Not updated");
    expect(formatCount(null)).toBe("Not updated");
    expect(formatCount(0)).toBe("0");
  });

  it("keeps a missing value null rather than zero", () => {
    const totals = sumDaily([daily("2026-03-01", null, null, null)], 1);
    expect(totals.gross_profit).toBeNull();
    expect(totals.gp_per_car).toBeNull();
  });

  it("tracks coverage per metric and never fills a blank field with zero", () => {
    const totals = sumDaily(
      [daily("2026-03-01", 1000, null, 5), daily("2026-03-02", 500, 3, 5)],
      2,
    );
    expect(totals.tires_sold).toBe(3);
    expect(totals.coverage.tires_sold).toEqual({ days_with_value: 1, days_missing_value: 1 });
    expect(totals.coverage.gross_profit.days_missing_value).toBe(0);
  });

  it("marks gp per car unavailable when gross profit and car count cover different days", () => {
    const totals = sumDaily(
      [daily("2026-03-01", 1000, 2, null), daily("2026-03-02", 500, 2, 5)],
      2,
    );
    expect(totals.gross_profit).toBe(1500);
    expect(totals.car_count).toBe(5);
    expect(totals.gp_per_car).toBeNull();
    expect(totals.gp_per_car_note).toMatch(/car count for 1 of 2/);
  });

  it("caveats gp per car when the period is only partly saved", () => {
    const totals = sumDaily([daily("2026-03-01", 1000, 2, 8)], 5);
    expect(totals.gp_per_car).toBe(125);
    expect(totals.gp_per_car_note).toMatch(/4 day\(s\) still missing/);
  });

  it("excludes records dated after the shop's business day", () => {
    const totals = sumDaily(
      [daily("2026-03-01", 1000, 2, 8), daily("2026-03-09", 9999, 9, 9)],
      1,
      "2026-03-01",
    );
    expect(totals.gross_profit).toBe(1000);
    expect(totals.covered_days).toBe(1);
  });
});

describe("month to date", () => {
  it("uses the latest cumulative snapshot instead of adding cumulative reports together", () => {
    const rows: MetricRow[] = [
      {
        business_date: "2026-03-05",
        scope: "mtd",
        gross_profit: 5000,
        tires_sold: 20,
        car_count: 40,
      },
      {
        business_date: "2026-03-06",
        scope: "mtd",
        gross_profit: 6000,
        tires_sold: 24,
        car_count: 48,
      },
      daily("2026-03-06", 1000, 4, 8),
    ];
    const result = monthToDate(rows, "2026-03", "2026-03-06");
    expect(result.basis).toBe("cumulative-snapshot");
    expect(result.gross_profit).toBe(6000);
    expect(result.as_of).toBe("2026-03-06");
    expect(result.gp_per_car).toBe(125);
    expect(result.stale).toBe(false);
    expect(result.days_behind).toBe(0);
  });

  it("reports an older cumulative snapshot as stale with its real as-of date", () => {
    const rows: MetricRow[] = [
      {
        business_date: "2026-03-05",
        scope: "mtd",
        gross_profit: 5000,
        tires_sold: 20,
        car_count: 40,
      },
    ];
    const result = monthToDate(rows, "2026-03", "2026-03-12");
    expect(result.as_of).toBe("2026-03-05");
    expect(result.stale).toBe(true);
    expect(result.days_behind).toBe(7);
  });

  it("falls back to summing daily rows when no cumulative snapshot exists", () => {
    const result = monthToDate(
      [daily("2026-03-01", 1000, 4, 5), daily("2026-03-02", 1000, 4, 5)],
      "2026-03",
      "2026-03-02",
    );
    expect(result.basis).toBe("daily-sum");
    expect(result.gross_profit).toBe(2000);
    expect(result.missing_days).toBe(0);
  });

  it("ignores other months and future dates", () => {
    const result = monthToDate(
      [daily("2026-02-28", 9999, 9, 9), daily("2026-03-20", 500, 1, 1)],
      "2026-03",
      "2026-03-03",
    );
    expect(result.basis).toBe("none");
    expect(result.gross_profit).toBeNull();
    expect(result.missing_days).toBe(3);
  });

  it("uses full month length for a completed past month", () => {
    const result = monthToDate([daily("2026-01-05", 1000, 2, 4)], "2026-01", "2026-03-03");
    expect(result.covered_days).toBe(1);
    expect(result.missing_days).toBe(30);
  });
});

describe("year to date", () => {
  it("respects the latest accepted ytd snapshot instead of the daily sum", () => {
    const rows: MetricRow[] = [
      daily("2026-01-05", 1000, 2, 4),
      {
        business_date: "2026-02-28",
        scope: "ytd",
        gross_profit: 90_000,
        tires_sold: 400,
        car_count: 600,
      },
      {
        business_date: "2026-03-31",
        scope: "ytd",
        gross_profit: 120_000,
        tires_sold: 520,
        car_count: 800,
      },
    ];
    const result = yearToDate(rows, "2026", "2026-04-02");
    expect(result.basis).toBe("cumulative-snapshot");
    expect(result.gross_profit).toBe(120_000);
    expect(result.gp_per_car).toBe(150);
    expect(result.as_of).toBe("2026-03-31");
    expect(result.stale).toBe(true);
  });

  it("counts elapsed days of the year when summing daily rows", () => {
    const result = yearToDate(
      [daily("2026-01-01", 1000, 2, 4), daily("2026-01-02", 1000, 2, 4)],
      "2026",
      "2026-03-01",
    );
    expect(result.basis).toBe("daily-sum");
    expect(result.gross_profit).toBe(2000);
    expect(dayOfYear("2026-03-01")).toBe(60);
    expect(result.covered_days).toBe(2);
    expect(result.missing_days).toBe(58);
  });

  it("never adds a cumulative snapshot to daily totals", () => {
    const rows: MetricRow[] = [
      daily("2026-01-05", 1000, 2, 4),
      {
        business_date: "2026-01-31",
        scope: "ytd",
        gross_profit: 40_000,
        tires_sold: 100,
        car_count: 200,
      },
    ];
    const result = yearToDate(rows, "2026", "2026-02-01");
    expect(result.gross_profit).toBe(40_000);
  });
});

describe("TV rotation", () => {
  it("alternates numbers and tech every 120 seconds", () => {
    expect(SCREEN_SECONDS).toBe(120);
    expect(screenAt(0)).toBe("numbers");
    expect(screenAt(119)).toBe("numbers");
    expect(screenAt(120)).toBe("tech");
    expect(screenAt(239)).toBe("tech");
    expect(screenAt(240)).toBe("numbers");
    expect(JOB_ROWS_PER_PAGE).toBeGreaterThan(0);
  });
});
