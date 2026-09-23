import { describe, expect, it } from "vitest";
import {
  dayOfYear,
  formatCount,
  formatCurrency,
  gpPerCar,
  monthToDate,
  shopToday,
  sumDaily,
  yearToDate,
  type MetricRow,
} from "./metrics-math";
import type { BusinessCalendar } from "./business-calendar";
import { SCREEN_SECONDS, screenAt } from "@/routes/_authenticated/tv";

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

describe("shopToday", () => {
  it("formats the business date in a valid, explicit IANA zone", () => {
    const date = new Date("2026-01-15T05:30:00Z");
    expect(shopToday("America/Chicago", date)).toBe("2026-01-14");
    expect(shopToday("UTC", date)).toBe("2026-01-15");
  });

  it("keeps the documented legacy no-arg default instead of throwing", () => {
    // Omitting timeZone entirely is the one legacy, non-authoritative path that
    // still silently defaults to America/Chicago (see the function's own doc
    // comment) - unlike every other caller, which must pass a validated zone.
    const date = new Date("2026-01-15T05:30:00Z");
    expect(shopToday(undefined, date)).toBe("2026-01-14");
  });

  it("throws instead of guessing for an empty or garbage zone", () => {
    const date = new Date("2026-01-15T05:30:00Z");
    expect(() => shopToday("", date)).toThrow(/timezone is not configured or invalid/i);
    expect(() => shopToday("Not/AZone", date)).toThrow(/timezone is not configured or invalid/i);
  });

  it("formats correctly across the America/Chicago DST transitions (2026-03-08, 2026-11-01)", () => {
    expect(shopToday("America/Chicago", new Date("2026-03-08T05:59:00Z"))).toBe("2026-03-07");
    expect(shopToday("America/Chicago", new Date("2026-03-08T07:30:00Z"))).toBe("2026-03-08");
    expect(shopToday("America/Chicago", new Date("2026-11-01T06:00:00Z"))).toBe("2026-11-01");
    expect(shopToday("America/Chicago", new Date("2026-11-02T06:00:00Z"))).toBe("2026-11-02");
  });

  it("depends only on the explicit zone argument, never on the running machine's local timezone", () => {
    const instant = new Date("2026-01-15T05:30:00Z");
    expect(shopToday("Asia/Tokyo", instant)).toBe("2026-01-15");
    expect(shopToday("America/Chicago", instant)).toBe("2026-01-14");
  });
});

describe("wired calendar in month/year totals", () => {
  const monFri: BusinessCalendar = {
    schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
    exceptions: [],
  };

  it("retains an actual weekend entry in the sum without letting it cancel a missing weekday", () => {
    // Expected open (Mon-Fri) dates for Sept 1-20 (today's own Sept 21 is not yet
    // due): 1,2,3,4,7,8,9,10,11,14,15,16,17,18 = 14 dates. Sept 15 is a Tuesday and
    // is left unreported; Sept 19 (a Saturday) is reported anyway.
    const rows: MetricRow[] = [
      daily("2026-09-01", 100, 1, 1),
      daily("2026-09-02", 100, 1, 1),
      daily("2026-09-03", 100, 1, 1),
      daily("2026-09-04", 100, 1, 1),
      daily("2026-09-07", 100, 1, 1),
      daily("2026-09-08", 100, 1, 1),
      daily("2026-09-09", 100, 1, 1),
      daily("2026-09-10", 100, 1, 1),
      daily("2026-09-11", 100, 1, 1),
      daily("2026-09-19", 50, 1, 1), // recorded Saturday, outside the expected open-date set
    ];
    const result = monthToDate(rows, "2026-09", "2026-09-21", monFri);
    expect(result.gross_profit).toBe(950); // 900 weekday total + the retained Saturday 50
    expect(result.covered_days).toBe(10);
    // Still 5 missing weekdays (14, 15, 16, 17, 18) - the Saturday entry cancels none of them.
    expect(result.missing_days).toBe(5);
  });

  it("does not treat today's own not-yet-due report as missing, but still flags an earlier unreported open day", () => {
    const result = monthToDate([daily("2026-09-18", 100, 1, 1)], "2026-09", "2026-09-21", monFri);
    // 14 expected open weekdays (Sept 1-20); only Sept 18 reported; Sept 21 (today)
    // itself is excluded from the expected set entirely, not counted as missing.
    expect(result.missing_days).toBe(13);
  });

  it("throws the explicit calendar-coverage error instead of guessing when no schedule covers the month", () => {
    const noSchedule: BusinessCalendar = {
      schedules: [{ effective_from: "2030-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
      exceptions: [],
    };
    expect(() => monthToDate([], "2026-09", "2026-09-21", noSchedule)).toThrow(
      "The shop calendar does not cover this reporting month.",
    );
  });

  it("retains an actual weekend entry in yearToDate the same way", () => {
    const rows: MetricRow[] = [
      daily("2026-01-05", 500, 2, 2), // Monday, reported
      daily("2026-01-10", 200, 1, 1), // Saturday, recorded anyway
    ];
    const result = yearToDate(rows, "2026", "2026-01-12", monFri);
    expect(result.gross_profit).toBe(700);
    expect(result.covered_days).toBe(2);
    // 7 expected open weekdays (Jan 1-11) minus the 1 reported = 6 still missing.
    expect(result.missing_days).toBe(6);
  });

  it("throws the explicit calendar-coverage error for yearToDate too", () => {
    const noSchedule: BusinessCalendar = {
      schedules: [{ effective_from: "2030-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
      exceptions: [],
    };
    expect(() => yearToDate([], "2026", "2026-01-12", noSchedule)).toThrow(
      "The shop calendar does not cover this reporting year.",
    );
  });
});

describe("TV rotation", () => {
  it("alternates numbers and shop screens every SCREEN_SECONDS", () => {
    expect(SCREEN_SECONDS).toBeGreaterThan(0);
    expect(screenAt(0)).toBe("numbers");
    expect(screenAt(SCREEN_SECONDS - 1)).toBe("numbers");
    expect(screenAt(SCREEN_SECONDS)).toBe("shop");
    expect(screenAt(SCREEN_SECONDS * 2 - 1)).toBe("shop");
    expect(screenAt(SCREEN_SECONDS * 2)).toBe("numbers");
  });
});
