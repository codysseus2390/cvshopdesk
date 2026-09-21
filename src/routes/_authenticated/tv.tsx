import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccessGate } from "@/components/access-gate";
import { TvHeader } from "@/components/tv/tv-header";
import { TvNumbersScreen } from "@/components/tv/tv-numbers-screen";
import { TvShopScreen, type TvNextUpItem, type TvScheduleRow } from "@/components/tv/tv-shop-screen";
import { TvStatusBar } from "@/components/tv/tv-status-bar";
import { cn } from "@/lib/utils";
import { useDashboard } from "./hub";
import { useBoard, type BoardJob } from "./board";
import { listDisplayNotifications } from "@/lib/notifications.functions";

/** Each screen's time on air before rotating to the next. */
export const SCREEN_SECONDS = 18;
/** Most schedule rows shown at once — the summary counts still reflect everything. */
const SCHEDULE_ROW_LIMIT = 9;

/** Which screen is showing after `elapsed` seconds: numbers, then shop, repeating. */
export function screenAt(elapsedSeconds: number): "numbers" | "shop" {
  return Math.floor(elapsedSeconds / SCREEN_SECONDS) % 2 === 0 ? "numbers" : "shop";
}

export const Route = createFileRoute("/_authenticated/tv")({
  head: () => ({
    meta: [
      { title: "TV mode — Cedar Valley Hub" },
      {
        name: "description",
        content: "Staff-only shop command board: rotating shop numbers and today's job board.",
      },
      { property: "og:title", content: "TV mode — Cedar Valley Hub" },
      { property: "og:description", content: "Full screen staff display." },
    ],
  }),
  component: () => (
    <AccessGate>
      <TvMode />
    </AccessGate>
  ),
});

function lastName(name: string | null): string {
  if (!name) return "Customer not recorded";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

function shortTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?[AP]M$/i, "");
}

function buildSchedule(board: ReturnType<typeof useBoard>["data"]): TvScheduleRow[] {
  if (!board) return [];
  const rows: (TvScheduleRow & { sortKey: number | null })[] = [];

  for (const job of [...board.appointments]) {
    rows.push({
      id: job.id,
      time: shortTime(job.appointment_at),
      vehicleCustomer: `${job.vehicle_label ?? "Vehicle not recorded"} · ${lastName(job.customer_name)}`,
      job: job.requested_service ?? "Service not recorded",
      status: "upcoming",
      sortKey: job.appointment_at ? new Date(job.appointment_at).getTime() : null,
    });
  }
  for (const job of board.appointmentsWithoutTime) {
    rows.push({
      id: job.id,
      time: "—",
      vehicleCustomer: `${job.vehicle_label ?? "Vehicle not recorded"} · ${lastName(job.customer_name)}`,
      job: job.requested_service ?? "Service not recorded",
      status: "upcoming",
      sortKey: null,
    });
  }
  for (const job of [...board.jobs, ...board.jobsWithoutArrival] as BoardJob[]) {
    rows.push({
      id: job.id,
      time: shortTime(job.arrival_at),
      vehicleCustomer: `${job.vehicle_label ?? "Vehicle not recorded"} · ${lastName(job.customer_name)}`,
      job: job.requested_service ?? "Service not recorded",
      status: "in_shop",
      sortKey: job.arrival_at ? new Date(job.arrival_at).getTime() : null,
    });
  }
  for (const job of board.done as BoardJob[]) {
    const anchor = job.arrival_at ?? job.appointment_at;
    rows.push({
      id: job.id,
      time: shortTime(anchor),
      vehicleCustomer: `${job.vehicle_label ?? "Vehicle not recorded"} · ${lastName(job.customer_name)}`,
      job: job.requested_service ?? "Service not recorded",
      status: "done",
      sortKey: anchor ? new Date(anchor).getTime() : null,
    });
  }

  rows.sort((a, b) => {
    if (a.sortKey === null && b.sortKey === null) return 0;
    if (a.sortKey === null) return 1;
    if (b.sortKey === null) return -1;
    return a.sortKey - b.sortKey;
  });

  return rows.map(({ sortKey: _sortKey, ...row }) => row);
}

function TvMode() {
  const dashboard = useDashboard();
  const board = useBoard();
  const fetchAnnouncements = useServerFn(listDisplayNotifications);
  const announcements = useQuery({
    queryKey: ["display-notifications"],
    queryFn: () => fetchAnnouncements(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
  });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const screen = screenAt(elapsed);

  const schedule = buildSchedule(board.data);
  const visibleSchedule = schedule.slice(0, SCHEDULE_ROW_LIMIT);
  const counts = {
    inShop: (board.data?.jobs.length ?? 0) + (board.data?.jobsWithoutArrival.length ?? 0),
    upcoming: (board.data?.appointments.length ?? 0) + (board.data?.appointmentsWithoutTime.length ?? 0),
    done: board.data?.done.length ?? 0,
  };
  const nextUp: TvNextUpItem[] = (board.data?.appointments ?? []).slice(0, 3).map((job) => ({
    id: job.id,
    time: shortTime(job.appointment_at),
    vehicleCustomer: `${job.vehicle_label ?? "Vehicle not recorded"} · ${lastName(job.customer_name)}`,
  }));
  const nextAppointment = board.data?.appointments[0]?.appointment_at
    ? shortTime(board.data.appointments[0].appointment_at)
    : null;

  const problem =
    dashboard.error instanceof Error
      ? dashboard.error.message
      : board.error instanceof Error
        ? board.error.message
        : null;
  const staleMinutes = Math.round(
    (Date.now() - Math.min(dashboard.dataUpdatedAt, board.dataUpdatedAt)) / 60_000,
  );
  const stale = Boolean(dashboard.dataUpdatedAt && board.dataUpdatedAt && staleMinutes >= 5);
  const alert = problem
    ? `Screen not updating: ${problem}`
    : stale
      ? `Numbers may be behind — no refresh for ${staleMinutes} min`
      : null;

  return (
    <div
      className={cn(
        "dark min-h-screen p-8 text-foreground",
        screen === "numbers" ? "tv-bg-numbers" : "tv-bg-shop",
      )}
    >
      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col gap-6">
        <TvHeader
          title={screen === "numbers" ? "Shop numbers" : "Today's shop"}
          timezone={board.data?.timezone}
          alert={alert}
        />

        {(announcements.data?.length ?? 0) > 0 && (
          <div className="space-y-2">
            {(announcements.data ?? []).slice(0, 2).map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border-l-[6px] bg-card p-4",
                  item.notification?.priority === "high" ? "border-destructive" : "border-primary",
                )}
              >
                <p className="font-display text-xl font-bold text-foreground">
                  {item.notification?.title}
                </p>
                <p className="mt-0.5 text-base text-muted-foreground">
                  {item.notification?.message}
                </p>
              </div>
            ))}
          </div>
        )}

        <div key={screen} className="tv-screen-enter flex-1">
          {screen === "numbers" ? (
            <TvNumbersScreen dashboard={dashboard.data} />
          ) : (
            <TvShopScreen rows={visibleSchedule} counts={counts} nextUp={nextUp} />
          )}
        </div>

        <TvStatusBar
          inShop={counts.inShop}
          upcoming={counts.upcoming}
          done={counts.done}
          nextAppointment={nextAppointment}
        />
      </div>
    </div>
  );
}
