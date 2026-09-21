import { TvStatusBadge } from "./tv-status-badge";
import type { TvStatus } from "./tv-status";

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
    <div className="grid grid-cols-[6rem_1fr_auto] items-center gap-5 rounded-xl border border-border/70 bg-card px-5 py-4">
      <p className="font-display text-2xl font-bold tabular-nums text-foreground">{time}</p>
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-bold text-foreground">
          {vehicleCustomer}
        </p>
        <p className="truncate text-base text-muted-foreground">{job}</p>
      </div>
      <TvStatusBadge status={status} />
    </div>
  );
}
