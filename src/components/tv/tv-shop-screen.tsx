import { Card, CardContent } from "@/components/ui/card";
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
    <div className="grid grid-cols-[1fr_360px] gap-6">
      <section className="space-y-3">
        {rows.length === 0 && (
          <Card className="border-border/70 bg-card">
            <CardContent className="p-8 text-center text-lg text-muted-foreground">
              No jobs or appointments on today's board yet.
            </CardContent>
          </Card>
        )}
        {rows.map((row) => (
          <TvAppointmentRow
            key={row.id}
            time={row.time}
            vehicleCustomer={row.vehicleCustomer}
            job={row.job}
            status={row.status}
          />
        ))}
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <SummaryTile label="In shop" value={counts.inShop} status="in_shop" />
          <SummaryTile label="Upcoming" value={counts.upcoming} status="upcoming" />
          <SummaryTile label="Done today" value={counts.done} status="done" />
        </div>

        <Card className="border-border/70 bg-card">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Next up
            </p>
            <div className="mt-3 space-y-3">
              {nextUp.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing else scheduled today.</p>
              )}
              {nextUp.map((item) => (
                <div
                  key={item.id}
                  className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <span className="truncate font-display text-lg font-bold text-foreground">
                    {item.vehicleCustomer}
                  </span>
                  <span className="shrink-0 font-display text-lg font-bold tabular-nums text-primary">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: TvStatus;
}) {
  return (
    <Card className="border-border/70 bg-card">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </div>
        <TvStatusBadge status={status} />
      </CardContent>
    </Card>
  );
}
