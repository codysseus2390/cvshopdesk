import { describe, expect, it } from "vitest";
import {
  formatProductivity,
  overallProductivity,
  SHOP_PRODUCTIVITY_TECHNICIAN,
  type ProductivityInput,
} from "./productivity-math";
import { resolvePeriod } from "./numbers-math";

const row = (overrides: Partial<ProductivityInput>): ProductivityInput => ({
  business_date: "2026-09-15",
  technician: "Dale",
  productivity_pct: null,
  hours_billed: null,
  hours_worked: null,
  period_scope: null,
  ...overrides,
});

describe("overall mechanic productivity", () => {
  const week = resolvePeriod("weekly", "2026-09-16");

  it("uses total billed divided by total worked instead of averaging percentages", () => {
    const value = overallProductivity(
      [
        row({ technician: "A", productivity_pct: 200, hours_billed: 8, hours_worked: 4 }),
        row({ technician: "B", productivity_pct: 50, hours_billed: 4, hours_worked: 8 }),
      ],
      week,
      "weekly",
      "2026-09-16",
    );
    expect(value).toBe(100);
  });

  it("prefers an accepted overall period value", () => {
    const value = overallProductivity(
      [
        row({ hours_billed: 8, hours_worked: 4 }),
        row({
          technician: SHOP_PRODUCTIVITY_TECHNICIAN,
          productivity_pct: 92.4,
          period_scope: "weekly",
        }),
      ],
      week,
      "weekly",
      "2026-09-16",
    );
    expect(value).toBe(92.4);
  });

  it("returns unavailable for missing inputs or zero total worked hours", () => {
    expect(overallProductivity([], week, "weekly", "2026-09-16")).toBeNull();
    expect(
      overallProductivity(
        [row({ hours_billed: 8, hours_worked: 0 })],
        week,
        "weekly",
        "2026-09-16",
      ),
    ).toBeNull();
  });

  it("formats only meaningful precision", () => {
    expect(formatProductivity(92)).toBe("92%");
    expect(formatProductivity(92.43782)).toBe("92.4%");
    expect(formatProductivity(null)).toBe("—");
  });
});
