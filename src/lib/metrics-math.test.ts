import { describe, expect, it } from "vitest";
import { formatCount, formatCurrency, gpPerCar, monthToDate, sumDaily, type MetricRow } from "./metrics-math";
import { JOB_ROWS_PER_PAGE, SCREEN_SECONDS, screenAt } from "@/routes/_authenticated/tv";

const daily = (date: string, gp: number | null, tires: number | null, cars: number | null): MetricRow => ({
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
      { business_date: "2026-03-02", scope: "mtd", gross_profit: 1500, tires_sold: 6, car_count: 10 },
    ];
    const totals = sumDaily(rows, 2);
    expect(totals.gross_profit).toBe(1500);
    expect(totals.car_count).toBe(10);
    expect(totals.gp_per_car).toBe(150);
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
});

describe("month to date", () => {
  it("uses the latest cumulative snapshot instead of adding cumulative reports together", () => {
    const rows: MetricRow[] = [
      { business_date: "2026-03-05", scope: "mtd", gross_profit: 5000, tires_sold: 20, car_count: 40 },
      { business_date: "2026-03-06", scope: "mtd", gross_profit: 6000, tires_sold: 24, car_count: 48 },
      daily("2026-03-06", 1000, 4, 8),
    ];
    const result = monthToDate(rows, "2026-03", 6);
    expect(result.basis).toBe("cumulative-snapshot");
    expect(result.gross_profit).toBe(6000);
    expect(result.as_of).toBe("2026-03-06");
    expect(result.gp_per_car).toBe(125);
  });

  it("falls back to summing daily rows when no cumulative snapshot exists", () => {
    const result = monthToDate([daily("2026-03-01", 1000, 4, 5), daily("2026-03-02", 1000, 4, 5)], "2026-03", 2);
    expect(result.basis).toBe("daily-sum");
    expect(result.gross_profit).toBe(2000);
  });

  it("ignores other months", () => {
    const result = monthToDate([daily("2026-02-28", 9999, 9, 9)], "2026-03", 3);
    expect(result.basis).toBe("none");
    expect(result.gross_profit).toBeNull();
    expect(result.missing_days).toBe(3);
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
