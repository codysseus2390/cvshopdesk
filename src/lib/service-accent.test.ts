import { describe, expect, it } from "vitest";
import {
  normalizeServiceCodes,
  primaryServiceCode,
  SERVICE_ACCENT_COLOR,
  serviceAccentColor,
} from "./service-accent";

describe("service accent mapping", () => {
  it("maps known service phrases to the right code", () => {
    expect(normalizeServiceCodes("Wheel Alignment")).toEqual(["ALIGN"]);
    expect(normalizeServiceCodes("Brake pads front")).toEqual(["BRAKE"]);
    expect(normalizeServiceCodes("Flat repair")).toEqual(["FLAT"]);
    expect(normalizeServiceCodes("60 point inspection")).toEqual(["INSP"]);
    expect(normalizeServiceCodes("Alternator diagnosis")).toEqual(["MECH"]);
    expect(normalizeServiceCodes("Full synthetic oil change")).toEqual(["OIL"]);
    expect(normalizeServiceCodes("Tire rotation")).toEqual(["ROT"]);
    expect(normalizeServiceCodes("New tire install")).toEqual(["TIRE"]);
  });

  it("falls back to OTHER for a real but unrecognized service, and to nothing when there is none", () => {
    expect(normalizeServiceCodes("Detail the interior")).toEqual(["OTHER"]);
    expect(normalizeServiceCodes(null)).toEqual([]);
    expect(normalizeServiceCodes("")).toEqual([]);
    expect(normalizeServiceCodes("   ")).toEqual([]);
  });

  it("splits multiple services and keeps first-mentioned order without duplicates", () => {
    expect(normalizeServiceCodes("Oil change · Tire rotation")).toEqual(["OIL", "ROT"]);
    expect(normalizeServiceCodes("Brake service and brake fluid flush")).toEqual(["BRAKE"]);
  });

  it("uses the first service as the primary and resolves its accent color", () => {
    expect(primaryServiceCode("Tire rotation, oil change")).toBe("ROT");
    expect(serviceAccentColor("Tire rotation, oil change")).toBe(SERVICE_ACCENT_COLOR.ROT);
    expect(serviceAccentColor(null)).toBeNull();
  });
});
