import { Link } from "@tanstack/react-router";
import { CalendarDays, CircleUserRound, Link2, Monitor, Settings, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TvNotificationPanel } from "@/components/tv-notification-panel";
import { useBoard } from "@/routes/_authenticated/board";
import { buildTvBoard, tvTime } from "@/lib/tv-board";
import { formatProductivity } from "@/lib/productivity-math";

type MechanicValue = number | null | undefined;
export type DashboardMechanics = {
  names: string[];
  previous_day: Record<string, MechanicValue>;
  week: Record<string, MechanicValue>;
  month: Record<string, MechanicValue>;
};

export function DashboardMiddleRow() {
  return (
    <section
      className="stagger-in grid items-stretch gap-3 xl:grid-cols-2"
      aria-label="Shop activity"
    >
      <SchedulePanel />
      <TvNotificationPanel />
    </section>
  );
}

function SchedulePanel() {
  const board = useBoard();
  const schedule = board.data ? buildTvBoard(board.data, Date.now()).schedule : [];
  const timezone = board.data?.timezone ?? "America/Chicago";

  return (
    <Card className="card-lift h-full min-w-0 rounded-2xl border-border/90 bg-card shadow-card panel-glow-steel">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <CardTitle className="flex min-w-0 items-center gap-2 font-body text-base font-semibold">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <CalendarDays className="h-4 w-4" />
          </span>
          Schedule
        </CardTitle>
        <Link to="/tv" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          TV mode
        </Link>
      </CardHeader>
      <CardContent className="min-h-[252px] px-4 py-3">
        <p className="mb-2 text-xs text-muted-foreground">Next 12 hours · shop time</p>
        {board.isLoading && <p className="py-4 text-sm text-muted-foreground">Loading schedule…</p>}
        {board.isError && (
          <p role="alert" className="py-4 text-sm text-destructive">
            Schedule could not be loaded.
          </p>
        )}
        {!board.isLoading && !board.isError && board.data?.appointmentError && (
          <p role="alert" className="py-4 text-sm text-destructive">
            {board.data.appointmentError}
          </p>
        )}
        {!board.isLoading &&
          !board.isError &&
          !board.data?.appointmentError &&
          schedule.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No appointments in the next 12 hours.
            </p>
          )}
        {schedule.length > 0 && (
          <div className="max-h-56 overflow-y-auto" aria-label="Today's TV schedule">
            {schedule.map((job) => (
              <div
                key={job.id}
                className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 border-b border-border/70 py-2.5 last:border-0"
              >
                <p className="text-xs font-bold tabular-nums text-foreground">
                  {tvTime(job.appointment_at, timezone)}
                </p>
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    title={job.customer_name ?? undefined}
                  >
                    {job.customer_name ?? "Customer not recorded"}
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={job.vehicle_label ?? undefined}
                  >
                    {job.vehicle_label ?? "Vehicle not recorded"}
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={job.requested_service ?? undefined}
                  >
                    {job.requested_service ?? "Service not recorded"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MechanicProductivityPanel({ mechanics }: { mechanics: DashboardMechanics }) {
  return (
    <Card className="card-lift h-full min-w-0 rounded-xl border-border/70 bg-card shadow-card panel-glow-profit">
      <CardContent className="flex h-full min-h-[11.5rem] flex-col p-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Wrench className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">Mechanic productivity</p>
            <p className="text-xs text-muted-foreground">Production %</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_repeat(3,3rem)] gap-1 border-b border-border/60 pb-1 text-[10px] text-muted-foreground">
          <span>Mechanic</span>
          <span className="text-right">Prev</span>
          <span className="text-right">Week</span>
          <span className="text-right">Month</span>
        </div>
        <div className="max-h-28 min-h-0 flex-1 overflow-y-auto">
          {mechanics.names.length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">
              No mechanic production recorded yet.
            </p>
          )}
          {mechanics.names.map((name) => (
            <div
              key={name}
              className="grid grid-cols-[minmax(0,1fr)_repeat(3,3rem)] items-center gap-1 border-b border-border/40 py-1.5 text-xs last:border-0"
            >
              <span className="truncate font-medium" title={name}>
                {name}
              </span>
              <span className="text-right tabular-nums">
                {formatProductivity(mechanics.previous_day[name] ?? null)}
              </span>
              <span className="text-right tabular-nums">
                {formatProductivity(mechanics.week[name] ?? null)}
              </span>
              <span className="text-right font-semibold tabular-nums">
                {formatProductivity(mechanics.month[name] ?? null)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemSettingsPanel() {
  const tiles = [
    {
      label: "Shop info",
      description: "Hours, address and contacts",
      icon: CircleUserRound,
      to: "/settings",
    },
    {
      label: "Integrations",
      description: "TireShop, accounting and more",
      icon: Link2,
      to: "/settings",
    },
    { label: "Display & devices", description: "TV mode and computers", icon: Monitor, to: "/tv" },
    {
      label: "Hank settings",
      description: "AI preferences and shortcuts",
      icon: Settings,
      to: "/settings",
    },
  ] as const;
  return (
    <Card className="min-w-0 rounded-2xl border-border/90 bg-card shadow-card panel-glow-steel">
      <CardHeader className="flex-row items-center justify-between gap-2 px-4 py-3">
        <CardTitle className="flex items-center gap-2 font-body text-base font-semibold">
          <Settings className="h-5 w-5 text-foreground" />
          System settings
        </CardTitle>
        <Link to="/settings" className="text-xs font-semibold text-primary hover:underline">
          Open settings
        </Link>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.label}
              to={tile.to}
              className="rounded-xl border border-border/70 bg-muted/35 p-3 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:-translate-y-px"
            >
              <Icon className="mb-2 h-5 w-5 text-foreground" />
              <span className="block text-sm font-semibold">{tile.label}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                {tile.description}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
