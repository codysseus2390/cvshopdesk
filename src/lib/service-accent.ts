/**
 * Central service-code -> accent-color mapping for TV Mode, plus a normalization
 * helper for the freeform service text Autoflow (and manual imports) actually send.
 * Keep every service color decision here — components should never hardcode one.
 */
export type ServiceCode =
  "ALIGN" | "BRAKE" | "FLAT" | "INSP" | "MECH" | "OIL" | "ROT" | "TIRE" | "OTHER";

export const SERVICE_CODES: ServiceCode[] = [
  "ALIGN",
  "BRAKE",
  "FLAT",
  "INSP",
  "MECH",
  "OIL",
  "ROT",
  "TIRE",
  "OTHER",
];

export const SERVICE_ACCENT_COLOR: Record<ServiceCode, string> = {
  ALIGN: "#01FFFF",
  BRAKE: "#FF9600",
  FLAT: "#FFFF00",
  INSP: "#00FF00",
  MECH: "#FF9600",
  OIL: "#FF0000",
  OTHER: "#FF9600",
  ROT: "#800080",
  TIRE: "#FFFF00",
};

export const SERVICE_CODE_LABEL: Record<ServiceCode, string> = {
  ALIGN: "Alignment",
  BRAKE: "Brake service",
  FLAT: "Flat repair",
  INSP: "Inspection",
  MECH: "Mechanic service",
  OIL: "Oil change",
  OTHER: "Other",
  ROT: "Rotation",
  TIRE: "Tire install",
};

/** Checked in order so a specific phrase (e.g. "tire rotation") wins over a generic one. */
const SERVICE_PATTERNS: [ServiceCode, RegExp][] = [
  ["ALIGN", /\balign/i],
  ["FLAT", /\bflat\b|\bpunctur/i],
  ["ROT", /\brotat/i],
  ["BRAKE", /\bbrake/i],
  ["OIL", /\boil\b|\blube\b/i],
  ["INSP", /\binspect/i],
  ["TIRE", /\btires?\b|\btyres?\b|\bmount(ed|ing)?\b|\bdismount/i],
  [
    "MECH",
    /\bmechanic|\brepair|\bdiagnos|\bengine\b|\btransmission\b|\bsuspension\b|\bbelt\b|\bhose\b|\bbattery\b|\bstarter\b|\balternator\b/i,
  ],
];

/** Splits a freeform service string on common separators before matching each part. */
function splitServiceText(requestedService: string): string[] {
  return requestedService
    .split(/[·,;/+]|(?:\band\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Normalizes freeform service text into known codes, in order of first appearance.
 * A described service that doesn't match a known pattern becomes "OTHER" rather
 * than being dropped — it is real, just not one of the named categories.
 * No service text at all returns an empty list (nothing to accent).
 */
export function normalizeServiceCodes(requestedService: string | null | undefined): ServiceCode[] {
  if (!requestedService || !requestedService.trim()) return [];
  const parts = splitServiceText(requestedService);
  const source = parts.length > 0 ? parts : [requestedService];
  const codes: ServiceCode[] = [];
  for (const part of source) {
    const match = SERVICE_PATTERNS.find(([, pattern]) => pattern.test(part));
    const code = match?.[0] ?? "OTHER";
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** The dominant service for a job — the first one mentioned. */
export function primaryServiceCode(
  requestedService: string | null | undefined,
): ServiceCode | null {
  return normalizeServiceCodes(requestedService)[0] ?? null;
}

export function serviceAccentColor(requestedService: string | null | undefined): string | null {
  const code = primaryServiceCode(requestedService);
  return code ? SERVICE_ACCENT_COLOR[code] : null;
}
