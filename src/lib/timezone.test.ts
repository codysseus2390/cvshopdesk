import { describe, expect, it } from "vitest";
import { formatDateInTimeZone, isValidTimeZone, resolveShopTimeZone } from "./timezone";

describe("shared timezone helper", () => {
  it("accepts a real IANA zone", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
  });

  it("rejects missing, empty, and garbage values", () => {
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("   ")).toBe(false);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it("resolveShopTimeZone returns a valid zone unchanged", () => {
    expect(resolveShopTimeZone("America/Chicago")).toBe("America/Chicago");
  });

  it("resolveShopTimeZone throws a clear error instead of guessing", () => {
    expect(() => resolveShopTimeZone(null)).toThrow(/timezone is not configured or invalid/i);
    expect(() => resolveShopTimeZone(undefined)).toThrow(/timezone is not configured or invalid/i);
    expect(() => resolveShopTimeZone("bogus")).toThrow(/timezone is not configured or invalid/i);
  });

  it("formatDateInTimeZone validates first, then formats YYYY-MM-DD", () => {
    const date = new Date("2026-01-15T05:30:00Z");
    expect(formatDateInTimeZone("America/Chicago", date)).toBe("2026-01-14");
    expect(formatDateInTimeZone("UTC", date)).toBe("2026-01-15");
    expect(() => formatDateInTimeZone("bogus", date)).toThrow(
      /timezone is not configured or invalid/i,
    );
  });

  it("formats correctly across the America/Chicago spring-forward transition (2026-03-08)", () => {
    // 2026-03-08 02:00 local is skipped (CST -> CDT). Just before and just after
    // the gap must still land on the correct local calendar date.
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-03-08T05:59:00Z"))).toBe(
      "2026-03-07",
    );
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-03-08T07:30:00Z"))).toBe(
      "2026-03-08",
    );
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-03-09T04:59:00Z"))).toBe(
      "2026-03-08",
    );
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-03-09T05:00:00Z"))).toBe(
      "2026-03-09",
    );
  });

  it("formats correctly across the America/Chicago fall-back transition (2026-11-01)", () => {
    // 2026-11-01 01:00-02:00 local occurs twice (CDT -> CST); the calendar date
    // itself must stay 2026-11-01 throughout, then roll to 11-02 at local midnight.
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-11-01T05:59:00Z"))).toBe(
      "2026-11-01",
    );
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-11-01T06:00:00Z"))).toBe(
      "2026-11-01",
    );
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-11-02T05:59:00Z"))).toBe(
      "2026-11-01",
    );
    expect(formatDateInTimeZone("America/Chicago", new Date("2026-11-02T06:00:00Z"))).toBe(
      "2026-11-02",
    );
  });

  it("uses the explicit zone argument, not the running machine's local timezone", () => {
    // The same UTC instant must resolve to different calendar dates depending
    // only on the zone passed in, never on wherever this test happens to run.
    const instant = new Date("2026-01-15T05:30:00Z");
    expect(formatDateInTimeZone("Asia/Tokyo", instant)).toBe("2026-01-15");
    expect(formatDateInTimeZone("America/Chicago", instant)).toBe("2026-01-14");
  });
});
