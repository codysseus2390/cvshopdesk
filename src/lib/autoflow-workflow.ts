import { z } from "zod";
import { appointmentInstant, parseAutoflowAppointments } from "./autoflow-appointments";
import { workflowStatus } from "./tv-board";

const text = z.string().trim().max(1000).nullish();
const id = z
  .union([z.string().trim().min(1).max(120), z.number().int().nonnegative()])
  .transform(String);
const eventSchema = z.object({
  event: z.object({
    id: z.string(),
    type: z.literal("status_update"),
    timestamp: z.string().datetime({ offset: true }),
  }),
  shop: z.object({ id, domain: z.string() }),
  ticket: z.object({
    id,
    status: z.string().trim().min(1).max(120),
    invoice: id.nullish(),
    remote_id: id.nullish(),
  }),
  customer: z.object({ firstname: text, lastname: text }).nullish(),
  vehicle: z
    .object({ year: z.union([z.number(), z.string()]).nullish(), make: text, model: text })
    .nullish(),
});

export type WorkflowRow = Omit<
  ReturnType<typeof parseAutoflowAppointments>[number],
  | "arrival_at"
  | "job_status"
  | "local_status"
  | "local_note"
  | "local_updated_at"
  | "technician"
  | "disposition"
> & {
  arrival_at: string | null;
  job_status: string | null;
  local_status: string | null;
  local_note: string | null;
  local_updated_at: string | null;
  technician: string | null;
  disposition: string | null;
  completed_at: string | null;
  repair_order_number?: string | null;
  remote_ticket_id?: string | null;
};
export interface InboxEvent {
  payload: unknown;
  received_at: string;
}

/** Display projection only: snapshots and the append-only inbox are never rewritten. */
export function projectAutoflowWorkflow(
  events: InboxEvent[],
  seeds: WorkflowRow[],
  providerShopId: string,
  subdomain: string,
  timezone: string,
): WorkflowRow[] {
  const rows = new Map<string, WorkflowRow>(
    seeds.map((row) => [
      row.identity_key,
      {
        ...row,
        repair_order_number:
          row.repair_order_number ??
          row.flags.find((flag) => flag.startsWith("autoflow_ro:"))?.slice(12) ??
          null,
      },
    ]),
  );
  const parsed = events
    .map((record) => {
      const result = eventSchema.safeParse(record.payload);
      if (!result.success)
        throw new Error("An Autoflow workflow event is missing valid status/timestamp data.");
      const event = result.data;
      if (event.shop.id !== providerShopId || event.shop.domain !== `${subdomain}.autotext.me`)
        throw new Error("Autoflow workflow shop mismatch.");
      const instant = appointmentInstant(event.event.timestamp, timezone);
      if (!instant || Date.parse(instant) > Date.parse(record.received_at) + 300_000)
        throw new Error("Invalid Autoflow event time.");
      return { event, instant };
    })
    .sort((a, b) => a.instant.localeCompare(b.instant));
  for (const { event, instant } of parsed) {
    const identity = `autoflow:${event.ticket.id}`;
    const prior = rows.get(identity);
    // The RO reference is needed even when a verified baseline is newer than this event.
    if (prior) {
      prior.repair_order_number ??= event.ticket.invoice ?? null;
      prior.remote_ticket_id ??= event.ticket.remote_id ?? null;
    }
    const checkin = /^(check\s*in|checked\s*in)$/i.test(event.ticket.status);
    // Preserve the earliest known check-in across all later workflow transitions.
    const arrival =
      checkin && (!prior?.arrival_at || Date.parse(instant) < Date.parse(prior.arrival_at))
        ? instant
        : (prior?.arrival_at ?? null);
    if (prior && Date.parse(prior.snapshot_at) > Date.parse(instant)) {
      prior.arrival_at = arrival;
      continue;
    }
    const base = parseAutoflowAppointments(
      {
        response_code: 200,
        appointments: [
          {
            id: event.ticket.id,
            customer: {
              first_name: event.customer?.firstname,
              last_name: event.customer?.lastname,
            },
            vehicle: event.vehicle,
          },
        ],
      },
      timezone,
      instant,
    )[0]!;
    const row: WorkflowRow = {
      ...base,
      ...prior,
      id: identity,
      identity_key: identity,
      record_kind: "job",
      repair_order_number: event.ticket.invoice ?? prior?.repair_order_number ?? null,
      remote_ticket_id: event.ticket.remote_id ?? prior?.remote_ticket_id ?? null,
      customer_name: base.customer_name ?? prior?.customer_name ?? null,
      vehicle_label: base.vehicle_label ?? prior?.vehicle_label ?? null,
      arrival_at: arrival,
      job_status: event.ticket.status,
      snapshot_at: instant,
      completed_at:
        workflowStatus({ job_status: event.ticket.status, local_status: null }) === "done"
          ? instant
          : null,
    };
    rows.set(identity, row);
  }
  return [...rows.values()];
}
