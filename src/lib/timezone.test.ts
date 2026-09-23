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
});
