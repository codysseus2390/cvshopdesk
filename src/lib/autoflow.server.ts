import { createHash, timingSafeEqual } from "node:crypto";

/** Server-only transport. Callers must authorize the ShopDesk shop before use. */
export interface AutoflowConfig {
  subdomain: string;
  apiKey: string;
  apiPassword: string;
}

export function readAutoflowConfig(
  env: Record<string, string | undefined> = process.env,
): AutoflowConfig {
  const subdomain = env["AUTOFLOW_SUBDOMAIN"]?.trim();
  const apiKey = env["AUTOFLOW_API_KEY"];
  const apiPassword = env["AUTOFLOW_API_PASSWORD"];
  if (
    !subdomain ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) ||
    !apiKey?.trim() ||
    apiKey.includes(":") ||
    !apiPassword?.trim()
  ) {
    throw new Error("Autoflow connection settings are missing or invalid.");
  }
  return { subdomain, apiKey, apiPassword };
}

/** Read-only endpoints verified against Autoflow API v1 documentation. */
export type AutoflowReadRequest =
  | { resource: "appointments"; start: string; end: string }
  | { resource: "dvi"; roNumber: string }
  | { resource: "work_order"; roNumber: string };

/** Returns untrusted JSON: validate the resource payload before storing/displaying it. */
export async function readAutoflow(
  request: AutoflowReadRequest,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const config = readAutoflowConfig(env);
  const base = `https://${config.subdomain}.autotext.me/api/v1/`;
  let url: URL;
  if (request.resource === "appointments") {
    // Autoflow examples use local date/time strings. Do not silently change zones.
    const datetime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    const validLocalTime = (value: string) => {
      if (!datetime.test(value)) return false;
      const parsed = new Date(`${value}Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === value;
    };
    if (
      !validLocalTime(request.start) ||
      !validLocalTime(request.end) ||
      request.start > request.end
    ) {
      throw new Error("Autoflow appointment dates must be an ordered local date/time range.");
    }
    url = new URL("appointments", base);
    url.searchParams.set("start", request.start);
    url.searchParams.set("end", request.end);
  } else {
    const ro = request.roNumber.trim();
    if (
      !ro ||
      ro.length > 120 ||
      ro === "." ||
      ro === ".." ||
      /[/\\]/.test(ro) ||
      Array.from(ro).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    ) {
      throw new Error("A valid repair order number is required.");
    }
    const resource = request.resource === "dvi" ? "dvi" : "work_orders";
    url = new URL(`${resource}/${encodeURIComponent(ro)}`, base);
  }

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiPassword}`).toString("base64")}`,
      },
      // Never forward credentials through a redirect or cache customer records.
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Autoflow could not be reached. Please try again.");
  }
  if (!response.ok) {
    // Provider bodies may contain private data; never include them in errors.
    throw new Error(`Autoflow request failed (HTTP ${response.status}).`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Autoflow returned an invalid JSON response.");
  }
}

/**
 * Provider scheme: SHA256("ATME:{security_key}:{event.id}") in X-atme-hash.
 * This binds ONLY the event ID, not the body. It is not HMAC/body integrity,
 * freshness, deduplication, or shop authorization; the receiver must handle those.
 */
export function verifyAutoflowWebhookHash(
  eventId: unknown,
  receivedHash: string | null,
  securityKey: string | undefined,
): boolean {
  if (
    typeof eventId !== "string" ||
    !eventId.trim() ||
    eventId.length > 256 ||
    !securityKey?.trim() ||
    !receivedHash ||
    !/^[a-f0-9]{64}$/.test(receivedHash)
  ) {
    return false;
  }
  const expected = createHash("sha256").update(`ATME:${securityKey}:${eventId}`).digest();
  return timingSafeEqual(expected, Buffer.from(receivedHash, "hex"));
}
