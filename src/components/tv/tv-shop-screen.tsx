import { TvAppointmentRow } from "./tv-appointment-row";
import { TvStatusBadge } from "./tv-status-badge";
import type { TvStatus } from "./tv-status";

export interface TvScheduleRow {
  id: string;
  time: string;
  vehicleCustomer: string;
  job: string;
  status: TvStatus;
}

export interface TvNextUpItem {
  id: string;
  time: string;
  vehicleCustomer: string;
}

/**
 * Two lit glass panels on the 3D stage: the schedule fills the left, the counts and Next Up stack flush
 * down the right rail. Rows and tiles butt against each other with hairline
 * rules rather than sitting in separate cards.
 */
export function TvShopScreen({
  rows,
  counts,
  nextUp,
}: {
  rows: TvScheduleRow[];
  counts: { inShop: number; upcoming: number; done: number };
  nextUp: TvNextUpItem[];
}) {
  return (
    <div className="tv-stage grid min-h-0 flex-1 grid-cols-[1fr_22rem] gap-4">
      <section
        className="tv-glow-card flex min-h-0 flex-col overflow-hidden"
        style={{ "--tv-accent": "var(--color-primary)" } as React.CSSProperties}
      >
        {rows.length === 0 ? (
          <p className="flex flex-1 items-center justify-center p-8 text-center text-lg text-muted-foreground">
            No jobs or appointments on today's board yet.
          </p>
        ) : (
          rows.map((row) => (
            <TvAppointmentRow
              key={row.id}
              time={row.time}
              vehicleCustomer={row.vehicleCustomer}
              job={row.job}
              status={row.status}
            />
          ))
        )}
      </section>

      <section
        className="tv-glow-card flex min-h-0 flex-col overflow-hidden"
        style={{ "--tv-accent": "var(--color-secondary)" } as React.CSSProperties}
      >
        <SummaryTile label="In shop" value={counts.inShop} status="in_shop" />
        <SummaryTile label="Upcoming" value={counts.upcoming} status="upcoming" />
        <SummaryTile label="Done today" value={counts.done} status="done" />

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Next up
          </p>
          <div className="mt-2">
            {nextUp.length === 0 && (
              <p className="pt-2 text-sm text-muted-foreground">Nothing else scheduled today.</p>
            )}
            {nextUp.map((item) => (
              <div
                key={item.id}
                className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-0"
              >
                <span className="truncate font-display text-lg font-bold text-[#fffdf8]">
                  {item.vehicleCustomer}
                </span>
                <span className="shrink-0 font-display text-lg font-bold tabular-nums text-primary">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value, status }: { label: string; value: number; status: TvStatus }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 font-display text-[2.4rem] font-bold leading-none tabular-nums text-[#fffdf8]">
          {value}
        </p>
      </div>
      <TvStatusBadge status={status} />
    </div>
  );
}
