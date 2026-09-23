import { z } from "zod";

const text = z.string().trim().nullable().optional();
const appointment = z.object({
  id: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  date_time: text,
  customer: z.object({ first_name: text, last_name: text }).nullish(),
  vehicle: z
    .object({ year: z.union([z.number(), z.string()]).nullish(), make: text, model: text })
    .nullish(),
  reason_for_visit: z.array(z.object({ title: text })).nullish(),
});

/** Autoflow may omit an offset; interpret that wall time in the shop's timezone. */
export function appointmentInstant(
  value: string | null | undefined,
  timezone: string,
): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const wall = Date.parse(`${value}Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 19) !== value) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const local = (ms: number) => {
    const p = Object.fromEntries(
      formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    return `${p["year"]}-${p["month"]}-${p["day"]}T${p["hour"]}:${p["minute"]}:${p["second"]}`;
  };
  let instant = wall;
  for (let i = 0; i < 3; i++) instant += wall - Date.parse(`${local(instant)}Z`);
  // DST gaps have no corresponding instant. Do not invent one.
  return local(instant) === value ? new Date(instant).toISOString() : null;
}

export function parseAutoflowAppointments(payload: unknown, timezone: string, fetchedAt: string) {
  const parsed = z
    .object({ response_code: z.literal(200), appointments: z.array(appointment) })
    .safeParse(payload);
  if (!parsed.success) throw new Error("Autoflow returned an invalid appointment list.");
  const unique = new Map(parsed.data.appointments.map((row) => [String(row.id), row]));
  return [...unique.values()].map((row) => ({
    id: `autoflow:${row.id}`,
    record_kind: "appointment",
    external_id: String(row.id),
    identity_key: `autoflow:${row.id}`,
    customer_name:
      [row.customer?.first_name, row.customer?.last_name].filter(Boolean).join(" ") || null,
    vehicle_label:
      [row.vehicle?.year, row.vehicle?.make, row.vehicle?.model].filter(Boolean).join(" ") || null,
    requested_service:
      row.reason_for_visit
        ?.map((r) => r.title)
        .filter(Boolean)
        .join(" · ") || null,
    technician: null,
    appointment_at: appointmentInstant(row.date_time, timezone),
    arrival_at: null,
    disposition: null,
    job_status: null,
    snapshot_at: fetchedAt,
    local_status: null,
    local_note: null,
    local_updated_at: null,
    needs_review: false,
    flags: [] as string[],
  }));
}

