import { TvStatusBadge } from "./tv-status-badge";
import type { TvStatus } from "./tv-status";

/**
 * A flush row inside the schedule slab — no card, no gap. Rows share the
 * available height so the board always fills the screen exactly.
 */
export function TvAppointmentRow({
  time,
  vehicleCustomer,
  job,
  status,
}: {
  time: string;
  vehicleCustomer: string;
  job: string;
  status: TvStatus;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[5.5rem_1fr_auto] items-center gap-5 border-b border-border px-6 last:border-b-0 even:bg-white/[0.02]">
      <p className="font-display text-[1.55rem] font-bold tabular-nums text-[#fffdf8]">{time}</p>
      <div className="min-w-0">
        <p className="truncate font-display text-[1.35rem] font-bold text-[#fffdf8]">
          {vehicleCustomer}
        </p>
        <p className="truncate text-base text-muted-foreground">{job}</p>
      </div>
      <TvStatusBadge status={status} />
    </div>
  );
}
