/**
 * Pure helpers for turning reviewed import rows into shop records, and for
 * deciding what belongs on the shop-floor board.
 *
 * Nothing here contacts TireShop. Imported rows describe records that already
 * exist there; this app only stores its own copy.
 */

export type RawItem = Record<string, string | number | null | undefined>;

/** Values that mean "the report did not give a usable number". */
const UNREADABLE = new Set(["n/a", "na", "-", "--", "—", "?", "tbd", "unknown", "null", "n.a."]);

export interface NumericField {
  value: number | null;
  unreadable: boolean;
}

/**
 * Numbers are only accepted when they really read as a number.
 * "N/A", blanks and stray text stay null and are flagged — never zero.
 */
export function parseNumericField(raw: unknown): NumericField {
  if (raw === null || raw === undefined) return { value: null, unreadable: false };
  if (typeof raw === "number") {
    return Number.isFinite(raw)
      ? { value: raw, unreadable: false }
      : { value: null, unreadable: true };
  }
  const text = String(raw).trim();
  if (text === "") return { value: null, unreadable: false };
  if (UNREADABLE.has(text.toLowerCase())) return { value: null, unreadable: true };
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[$,\s()]/g, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return { value: null, unreadable: true };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { value: null, unreadable: true };
  return { value: negative ? -Math.abs(n) : n, unreadable: false };
}

export function pickText(item: RawItem, keys: string[]): string | null {
  for (const key of keys) {
    const raw = item[key];
    if (raw === null || raw === undefined) continue;
    const text = String(raw).trim();
    if (text === "") continue;
    if (UNREADABLE.has(text.toLowerCase())) continue;
    return text;
  }
  return null;
}

function pickTimestamp(
  item: RawItem,
  keys: string[],
): { value: string | null; unreadable: boolean } {
  const text = pickText(item, keys);
  if (!text) return { value: null, unreadable: false };
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return { value: null, unreadable: true };
  return { value: parsed.toISOString(), unreadable: false };
}

/**
 * Every row gets a durable identity. A TireShop identifier is preferred; rows
 * without one are keyed to their own import row so a retry updates the same
 * row instead of duplicating, and are flagged for a person to check.
 */
function identity(externalId: string | null, importId: string, index: number) {
  return externalId ? `ext:${externalId}` : `import:${importId}:row:${index}`;
}

export interface InventoryRow {
  identity_key: string;
  external_id: string | null;
  description: string;
  brand: string | null;
  size: string | null;
  quantity: number | null;
  price: number | null;
  cost: number | null;
  flags: string[];
  needs_review: boolean;
}

export function normalizeInventoryRows(items: RawItem[], importId: string): InventoryRow[] {
  return items.map((item, index) => {
    const flags: string[] = [];
    const externalId = pickText(item, ["external_id", "sku", "part_number", "item_number", "id"]);
    if (!externalId) flags.push("no TireShop item id — matched to this import row only");

    const quantity = parseNumericField(item["quantity"] ?? item["qty"] ?? item["on_hand"]);
    const price = parseNumericField(item["price"] ?? item["retail"]);
    const cost = parseNumericField(item["cost"]);
    if (quantity.unreadable) flags.push("quantity unreadable");
    if (price.unreadable) flags.push("price unreadable");
    if (cost.unreadable) flags.push("cost unreadable");

    const description = pickText(item, ["description", "item", "name", "product"]);
    if (!description) flags.push("description missing");

    return {
      identity_key: identity(externalId, importId, index),
      external_id: externalId,
      description: description ?? "Unlabelled item",
      brand: pickText(item, ["brand", "manufacturer"]),
      size: pickText(item, ["size", "tire_size"]),
      quantity: quantity.value === null ? null : Math.round(quantity.value),
      price: price.value,
      cost: cost.value,
      flags,
      needs_review: flags.length > 0,
    };
  });
}

export interface JobRow {
  identity_key: string;
  external_id: string | null;
  customer_name: string | null;
  vehicle_label: string | null;
  requested_service: string | null;
  technician: string | null;
  arrival_at: string | null;
  appointment_at: string | null;
  disposition: string | null;
  job_status: string | null;
  flags: string[];
  needs_review: boolean;
}

export function normalizeJobRows(items: RawItem[], importId: string): JobRow[] {
  return items.map((item, index) => {
    const flags: string[] = [];
    const externalId = pickText(item, [
      "external_id",
      "ticket",
      "work_order",
      "ro",
      "invoice_number",
      "id",
    ]);
    if (!externalId) flags.push("no TireShop record id — matched to this import row only");

    // Arrival is only ever a real recorded arrival time. It is never guessed
    // from the appointment time or from when the file was imported.
    const arrival = pickTimestamp(item, ["arrival_at", "arrived_at", "checked_in_at", "arrival"]);
    if (arrival.unreadable) flags.push("arrival time unreadable");
    const appointment = pickTimestamp(item, [
      "appointment_at",
      "appointment",
      "scheduled_at",
      "promised_at",
    ]);
    if (appointment.unreadable) flags.push("appointment time unreadable");

    return {
      identity_key: identity(externalId, importId, index),
      external_id: externalId,
      customer_name: pickText(item, ["customer_name", "customer", "name"]),
      vehicle_label: pickText(item, ["vehicle", "vehicle_label", "unit"]),
      requested_service: pickText(item, ["service", "requested_service", "concern", "description"]),
      technician: pickText(item, ["technician", "tech", "assigned_to"]),
      arrival_at: arrival.value,
      appointment_at: appointment.value,
      disposition: pickText(item, ["disposition", "customer_status", "waiting"]),
      job_status: pickText(item, ["status", "job_status", "work_status"]),
      flags,
      needs_review: flags.length > 0,
    };
  });
}

export interface CustomerRow {
  identity_key: string;
  external_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  vehicle_identity_key: string | null;
  vehicle_external_id: string | null;
  year: string | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  plate: string | null;
  flags: string[];
  needs_review: boolean;
}

export function normalizeCustomerRows(items: RawItem[], importId: string): CustomerRow[] {
  return items.map((item, index) => {
    const flags: string[] = [];
    const externalId = pickText(item, ["external_id", "customer_id", "account", "id"]);
    // Names alone are never treated as an identity.
    if (!externalId) flags.push("no TireShop customer id — matched to this import row only");
    const name = pickText(item, ["name", "customer", "customer_name"]);
    if (!name) flags.push("customer name missing");

    const vehicleExternal = pickText(item, ["vehicle_id", "vin"]);
    const hasVehicle = Boolean(
      vehicleExternal || pickText(item, ["make", "model", "year", "plate"]),
    );

    return {
      identity_key: identity(externalId, importId, index),
      external_id: externalId,
      name: name ?? "Name not recorded",
      phone: pickText(item, ["phone", "mobile", "telephone"]),
      email: pickText(item, ["email"]),
      vehicle_identity_key: hasVehicle
        ? vehicleExternal
          ? `ext:${vehicleExternal}`
          : `import:${importId}:vehicle:${index}`
        : null,
      vehicle_external_id: vehicleExternal,
      year: pickText(item, ["year"]),
      make: pickText(item, ["make"]),
      model: pickText(item, ["model"]),
      vin: pickText(item, ["vin"]),
      plate: pickText(item, ["plate", "license", "tag"]),
      flags,
      needs_review: flags.length > 0,
    };
  });
}

export function normalizeRows(
  kind: "inventory" | "jobs" | "appointments" | "customers",
  items: RawItem[],
  importId: string,
) {
  if (kind === "inventory") return normalizeInventoryRows(items, importId);
  if (kind === "customers") return normalizeCustomerRows(items, importId);
  return normalizeJobRows(items, importId);
}

// ---------------------------------------------------------------- board rules

const FINISHED = [
  "complete",
  "completed",
  "closed",
  "done",
  "finished",
  "paid",
  "invoiced",
  "picked up",
  "pickedup",
  "delivered",
  "cancelled",
  "canceled",
  "voided",
];

/** A job counts as finished only when a status word says so. Absence is not completion. */
export function isFinishedJob(job: { job_status?: string | null; local_status?: string | null }) {
  const words = [job.job_status, job.local_status]
    .filter(Boolean)
    .map((w) => String(w).toLowerCase());
  return words.some((word) => FINISHED.some((f) => word.includes(f)));
}

export interface BoardRow {
  id: string;
  record_kind: string;
  arrival_at: string | null;
  appointment_at: string | null;
  snapshot_at: string;
  job_status: string | null;
  local_status: string | null;
}

/** Grace period so an appointment does not vanish the second its time passes. */
export const APPOINTMENT_GRACE_MINUTES = 30;

/** YYYY-MM-DD for a timestamp in a given timezone — same technique as `shopToday`. */
function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function splitBoard<T extends BoardRow>(
  rows: T[],
  nowMs: number,
  today?: { date: string; timezone: string },
) {
  const cutoff = nowMs - APPOINTMENT_GRACE_MINUTES * 60_000;

  const appointmentRows = rows.filter((r) => r.record_kind === "appointment");
  const jobRows = rows.filter((r) => r.record_kind !== "appointment" && !isFinishedJob(r));
  // Finished rows are tracked separately so "done today" can be shown without
  // inventing a completion time: anchored on arrival (jobs) or appointment time.
  const finishedRows = rows.filter(isFinishedJob);

  return {
    // Upcoming only: anything already past (beyond the grace period) drops off.
    appointments: appointmentRows
      .filter((r) => r.appointment_at !== null && new Date(r.appointment_at).getTime() >= cutoff)
      .sort((a, b) => (a.appointment_at ?? "").localeCompare(b.appointment_at ?? "")),
    // Kept visible but clearly separate — no time is invented for them.
    appointmentsWithoutTime: appointmentRows.filter((r) => r.appointment_at === null),
    // Oldest known arrival first.
    jobs: jobRows
      .filter((r) => r.arrival_at !== null)
      .sort((a, b) => (a.arrival_at ?? "").localeCompare(b.arrival_at ?? "")),
    // Arrival unknown: never substituted with the snapshot or appointment time.
    jobsWithoutArrival: jobRows.filter((r) => r.arrival_at === null),
    // Finished records anchored to today's shop day by arrival (or appointment time
    // when there was no arrival). There is no completion timestamp in the data, so
    // this is "finished and tied to today", not "finished at some time today".
    done: today
      ? finishedRows.filter((r) => {
          const anchor = r.arrival_at ?? r.appointment_at;
          return anchor !== null && localDate(anchor, today.timezone) === today.date;
        })
      : [],
  };
}
