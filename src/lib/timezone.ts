/**
 * Shared validated-IANA-timezone helper. Pure and dependency-free so it is safe to
 * import from both client components (e.g. tv-clock.tsx, tv.tsx) and server code.
 * Never import server-only modules (supabase client.server.ts, etc.) here.
 *
 * Rule enforced: a shop's business timezone is never guessed. If it is missing or
 * not a real IANA zone, callers must fail visibly with a clear message instead of
 * silently defaulting to some hardcoded zone (e.g. "America/Chicago").
 */

const PROBE_DATE = new Date("2024-01-01T00:00:00Z");

/** True when `value` is a non-empty string the runtime accepts as an IANA time zone. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(PROBE_DATE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns `value` when it is a valid IANA time zone, otherwise throws a clear,
 * user-facing error. Use this everywhere a shop's stored timezone is read, instead
 * of `?? "America/Chicago"` or any other guessed default.
 */
export function resolveShopTimeZone(value: string | null | undefined): string {
  if (!isValidTimeZone(value)) {
    throw new Error(
      "This shop's timezone is not configured or invalid. Ask the owner to set a valid timezone in Settings.",
    );
  }
  return value;
}

/** Formats `date` (default: now) as YYYY-MM-DD in a validated `timeZone`. */
export function formatDateInTimeZone(timeZone: string, date: Date = new Date()): string {
  const zone = resolveShopTimeZone(timeZone);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
