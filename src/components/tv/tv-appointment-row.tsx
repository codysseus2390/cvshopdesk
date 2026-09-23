import { TvStatusBadge } from "./tv-status-badge";
import type { TvStatus } from "./tv-status";

/**
 * Exact string `shortTime()` in `src/routes/_authenticated/tv.tsx` returns
 * when the shop's stored timezone is invalid — the owner-approved
 * "Time unavailable" wording (Bay/lead decision, never a dash or jargon).
 * Kept as a literal here (not an import) to avoid a circular module
 * dependency between this leaf component and the `/tv` route file; if this
 * copy ever changes, update both places together.
 */
const TIME_UNAVAILABLE_LABEL = "Time unavailable";

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
  const timeUnavailable = time === TIME_UNAVAILABLE_LABEL;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[5.5rem_1fr_auto] items-center gap-5 border-b border-border px-6 last:border-b-0 even:bg-white/[0.02]">
      <div className="min-w-0 overflow-hidden">
        {timeUnavailable ? (
          <p className="font-display text-[0.95rem] font-bold uppercase leading-tight text-muted-foreground">
            <span className="block truncate">Time</span>
            <span className="block truncate">unavailable</span>
          </p>
        ) : (
          <p className="truncate font-display text-[1.55rem] font-bold tabular-nums text-[#fffdf8]">
            {time}
          </p>
        )}
      </div>
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
