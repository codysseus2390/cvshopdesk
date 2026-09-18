import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { AccessGate } from "@/components/access-gate";
import { MetricCard } from "@/components/metric-card";
import { CedarLogo } from "@/components/cedar-logo";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "./hub";
import { useBoard, waitingSince, type BoardJob } from "./board";
import { formatCount, formatCurrency, gpPerCar } from "@/lib/metrics-math";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listDisplayNotifications } from "@/lib/notifications.functions";

export const SCREEN_SECONDS = 120;
/** Rows that stay readable across a 1920x1080 screen. */
export const JOB_ROWS_PER_PAGE = 6;
/** How long each page of a long queue stays up before advancing. */
export const JOB_PAGE_SECONDS = 30;

/** Which screen is showing after `elapsed` seconds: numbers, then tech, repeating. */
export function screenAt(elapsedSeconds: number): "numbers" | "tech" {
  return Math.floor(elapsedSeconds / SCREEN_SECONDS) % 2 === 0 ? "numbers" : "tech";
}

/** Page of a long job list, advanced slowly so rows can be read. */
export function jobPageAt(elapsedSeconds: number, jobCount: number) {
  const pages = Math.max(1, Math.ceil(jobCount / JOB_ROWS_PER_PAGE));
  return { pages, page: Math.floor(elapsedSeconds / JOB_PAGE_SECONDS) % pages };
}

export const Route = createFileRoute("/_authenticated/tv")({
  head: () => ({
    meta: [
      { title: "TV mode — Cedar Valley Hub" },
      {
        name: "description",
        content: "Staff-only full screen rotation of Cedar Valley numbers and the job board.",
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
  const secondsLeft = SCREEN_SECONDS - (elapsed % SCREEN_SECONDS);

  // Known arrivals first (oldest first), then the clearly-labelled unknown group.
  const jobs: BoardJob[] = [...(board.data?.jobs ?? []), ...(board.data?.jobsWithoutArrival ?? [])];
  const { pages, page } = jobPageAt(elapsed, jobs.length);
  const visibleJobs = jobs.slice(
    page * JOB_ROWS_PER_PAGE,
    page * JOB_ROWS_PER_PAGE + JOB_ROWS_PER_PAGE,
  );
  const unknownFrom = board.data?.jobs.length ?? 0;

  const today = dashboard.data?.todayRow;
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

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="mb-8 flex items-center justify-between">
        <CedarLogo className="h-16 w-auto" />
        <div className="text-right text-lg text-muted-foreground">
          <p className="font-display text-2xl font-bold text-foreground">
            {screen === "numbers" ? "Today's numbers" : "Shop floor"}
          </p>
          <p>
            Imported snapshot · numbers saved{" "}
            {dashboard.data?.lastUpdate
              ? new Date(dashboard.data.lastUpdate).toLocaleString()
              : "never"}{" "}
            · jobs{" "}
            {board.data?.lastSnapshot
              ? new Date(board.data.lastSnapshot).toLocaleString()
              : "never"}
          </p>
          <p className="text-sm">
            Not a live TireShop connection · shop day {dashboard.data?.today ?? "—"} · next screen
            in {secondsLeft}s
          </p>
          {problem && (
            <p className="text-base font-semibold text-destructive">
              Screen not updating: {problem}
            </p>
          )}
          {!problem && stale && (
            <p className="text-base font-semibold text-destructive">
              Screen has not refreshed for {staleMinutes} minutes — numbers may be behind
            </p>
          )}
        </div>
      </header>

      {(announcements.data?.length ?? 0) > 0 && (
        <div className="mb-8 space-y-3">
          {(announcements.data ?? []).slice(0, 2).map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border-l-8 bg-card p-6 ${
                item.notification?.priority === "high" ? "border-destructive" : "border-primary"
              }`}
            >
              <p className="font-display text-3xl font-bold">{item.notification?.title}</p>
              <p className="mt-1 text-2xl text-muted-foreground">{item.notification?.message}</p>
            </div>
          ))}
        </div>
      )}

      {screen === "numbers" ? (
        <div className="space-y-8">
          <div className="grid gap-6 md:grid-cols-4">
            <MetricCard
              size="tv"
              label="Gross profit today"
              value={formatCurrency(today?.gross_profit ?? null)}
            />
            <MetricCard
              size="tv"
              label="Tires sold today"
              value={formatCount(today?.tires_sold ?? null)}
            />
            <MetricCard
              size="tv"
              label="Cars today"
              value={formatCount(today?.car_count ?? null)}
            />
            <MetricCard
              size="tv"
              label="GP per car today"
              value={formatCurrency(
                gpPerCar(today?.gross_profit ?? null, today?.car_count ?? null),
              )}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            <MetricCard
              label="Month to date GP"
              value={formatCurrency(dashboard.data?.mtd.gross_profit ?? null)}
            />
            <MetricCard
              label="MTD tires"
              value={formatCount(dashboard.data?.mtd.tires_sold ?? null)}
            />
            <MetricCard
              label="MTD cars"
              value={formatCount(dashboard.data?.mtd.car_count ?? null)}
            />
            <MetricCard
              label="MTD GP per car"
              value={formatCurrency(dashboard.data?.mtd.gp_per_car ?? null)}
              hint={dashboard.data?.mtd.gp_per_car_note ?? undefined}
            />
          </div>
          {dashboard.data?.mtd.as_of && (
            <p className="text-lg text-muted-foreground">
              Month to date from reports as of {dashboard.data.mtd.as_of}
              {dashboard.data.mtd.stale
                ? ` · ${dashboard.data.mtd.days_behind} day(s) behind, coverage incomplete`
                : ""}
            </p>
          )}
          {(dashboard.data?.monthly.length ?? 0) > 1 && (
            <div className="h-64 rounded-lg bg-card p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(dashboard.data?.monthly ?? []).map((m) => ({
                    month: m.month,
                    gp: m.totals.gross_profit,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 16 }} />
                  <YAxis tick={{ fontSize: 16 }} />
                  <Bar dataKey="gp" fill="var(--color-primary)" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 font-display text-3xl font-bold">Upcoming appointments</h2>
            <div className="space-y-3">
              {(board.data?.appointments ?? []).slice(0, JOB_ROWS_PER_PAGE).map((job) => (
                <div key={job.id} className="rounded-lg bg-card p-4 text-2xl">
                  <p className="font-display font-bold">
                    {job.appointment_at
                      ? new Date(job.appointment_at).toLocaleTimeString()
                      : "Time not recorded"}{" "}
                    · {job.customer_name ?? "Customer not recorded"}
                  </p>
                  <p className="text-lg text-muted-foreground">
                    {job.vehicle_label ?? "Vehicle not recorded"} ·{" "}
                    {job.requested_service ?? "Service not recorded"}
                  </p>
                </div>
              ))}
              {(board.data?.appointments.length ?? 0) === 0 && (
                <p className="text-xl text-muted-foreground">No upcoming appointment records.</p>
              )}
            </div>
          </section>
          <section>
            <h2 className="mb-4 font-display text-3xl font-bold">
              Unfinished jobs {pages > 1 ? `(${page + 1}/${pages})` : ""}
            </h2>
            <div className="space-y-3">
              {visibleJobs.map((job, i) => (
                <div key={job.id} className="rounded-lg bg-card p-4">
                  <p className="font-display text-2xl font-bold">
                    {job.customer_name ?? "Customer not recorded"} —{" "}
                    {job.vehicle_label ?? "Vehicle not recorded"}
                  </p>
                  <p className="text-lg text-muted-foreground">
                    {job.requested_service ?? "Service not recorded"} ·{" "}
                    {job.technician ?? "Tech not assigned"} ·{" "}
                    {page * JOB_ROWS_PER_PAGE + i >= unknownFrom
                      ? "Arrival time not recorded"
                      : waitingSince(job.arrival_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-base">
                    {job.disposition && <Badge variant="secondary">{job.disposition}</Badge>}
                    {job.job_status && <Badge variant="secondary">{job.job_status}</Badge>}
                    {job.local_status && <Badge>{job.local_status}</Badge>}
                  </div>
                </div>
              ))}
              {jobs.length === 0 && (
                <p className="text-xl text-muted-foreground">No unfinished job records.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
