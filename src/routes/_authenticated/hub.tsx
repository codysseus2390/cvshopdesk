import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, CalendarRange, Trophy } from "lucide-react";
import { getDashboard } from "@/lib/metrics.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount, formatCurrency, gpPerCar } from "@/lib/metrics-math";
import { usePermissions } from "@/components/use-permissions";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cedar Valley Hub" },
      { name: "description", content: "Today and month-to-date shop numbers from confirmed Cedar Valley records." },
      { property: "og:title", content: "Dashboard — Cedar Valley Hub" },
      { property: "og:description", content: "Confirmed daily and monthly shop numbers." },
    ],
  }),
  component: () => (
    <AccessGate>
      <Dashboard />
    </AccessGate>
  ),
});

/** Dashboard numbers refresh on their own and whenever the tab is focused, so an
 *  import saved on another device reaches this screen (and the shop day rolls over). */
export function useDashboard() {
  const fetchDashboard = useServerFn(getDashboard);
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });
}


function Dashboard() {
  const { data, isLoading, error } = useDashboard();
  const { data: shopContext } = useShopContext();
  const perms = usePermissions();
  const pending = shopContext?.pendingCount ?? 0;
  const hidden = perms.settings?.hidden_widgets ?? [];
  const shows = (key: string) => !hidden.includes(key);
  const targets = perms.settings?.targets ?? {};
  const goalNote = (key: string, actual: number | null) => {
    const goal = targets[key];
    if (goal === null || goal === undefined || actual === null) return undefined;
    const percent = goal > 0 ? Math.round((actual / goal) * 100) : null;
    return percent === null ? undefined : `${percent}% of the monthly goal`;
  };

  const today = data?.previousDayRow;
  const todayGp = today?.gross_profit ?? null;
  const todayCars = today?.car_count ?? null;
  const prevDayLabel = data?.previousDay
    ? new Date(`${data.previousDay}T00:00:00Z`).toLocaleDateString(undefined, {
        timeZone: "UTC",
        month: "long",
        day: "numeric",
      })
    : null;

  const monthlyByYear = useMemo(() => {
    if (!data?.monthly.length) return null;
    const years = Array.from(new Set(data.monthly.map((m) => m.month.slice(0, 4)))).sort();
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const label = (mo: string) => new Date(`2000-${mo}-01`).toLocaleString(undefined, { month: "short" });
    const rows = months.map((mo) => {
      const row: Record<string, number | string | null> = { month: label(mo) };
      for (const year of years) {
        const found = data.monthly.find((m) => m.month === `${year}-${mo}`);
        row[year] = found?.totals.gross_profit ?? null;
      }
      return row;
    });
    return { years, rows };
  }, [data?.monthly]);

  const YEAR_COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return (
    <AppShell title="Dashboard">
      {pending > 0 && (
        <Link
          to="/settings"
          className="mb-6 block rounded-md border border-accent bg-accent/10 px-4 py-3 text-sm font-semibold text-foreground"
        >
          {pending === 1 ? "1 person is waiting for access" : `${pending} people are waiting for access`} — review in
          Settings
        </Link>
      )}

      {isLoading && <p className="text-muted-foreground">Loading confirmed records…</p>}
      {error && <p className="text-destructive">{error instanceof Error ? error.message : "Could not load."}</p>}

      {data && (
        <div className="space-y-7">
          {shows("today") && (
          <section>
            <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold"><CalendarDays className="h-6 w-6 shrink-0 text-primary" />Previous day{prevDayLabel ? <span className="text-base font-semibold text-muted-foreground">{prevDayLabel}</span> : null}</h2>
              {perms.can("edit_dashboard_numbers") ? (
                <Button asChild size="sm" className="h-11 rounded-xl px-4 text-sm shadow-md">
                  <Link to="/entry">Enter today's numbers</Link>
                </Button>
              ) : (
                <Button size="sm" disabled className="h-11 rounded-xl px-4 text-sm" title="You don't have permission to enter numbers.">
                  Enter today's numbers
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Gross profit" value={formatCurrency(todayGp)} />
              <MetricCard label="Tires sold" value={formatCount(today?.tires_sold ?? null)} />
              <MetricCard label="Car count" value={formatCount(todayCars)} />
              <MetricCard
                label="GP per car"
                value={formatCurrency(gpPerCar(todayGp, todayCars))}
                hint={gpPerCar(todayGp, todayCars) === null ? "Needs gross profit and car count" : undefined}
              />
            </div>
            {!today && (
              <p className="mt-3 text-sm text-muted-foreground">
                No confirmed entry for today yet. Nothing is assumed to be zero.
              </p>
            )}
          </section>
          )}

          {shows("mtd") && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold"><CalendarRange className="h-5 w-5 text-secondary" />Month to date</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Gross profit"
                value={formatCurrency(data.mtd.gross_profit)}
                hint={
                  data.mtd.coverage.gross_profit.days_missing_value > 0
                    ? `${data.mtd.coverage.gross_profit.days_missing_value} saved day(s) have no gross profit`
                    : goalNote("gross_profit", data.mtd.gross_profit)
                }
              />
              <MetricCard
                label="Tires sold"
                value={formatCount(data.mtd.tires_sold)}
                hint={
                  data.mtd.coverage.tires_sold.days_missing_value > 0
                    ? `${data.mtd.coverage.tires_sold.days_missing_value} saved day(s) have no tire count`
                    : goalNote("tires_sold", data.mtd.tires_sold)
                }
              />
              <MetricCard
                label="Car count"
                value={formatCount(data.mtd.car_count)}
                hint={
                  data.mtd.coverage.car_count.days_missing_value > 0
                    ? `${data.mtd.coverage.car_count.days_missing_value} saved day(s) have no car count`
                    : goalNote("car_count", data.mtd.car_count)
                }
              />
              <MetricCard
                label="GP per car"
                value={formatCurrency(data.mtd.gp_per_car)}
                hint={data.mtd.gp_per_car_note ?? goalNote("gp_per_car", data.mtd.gp_per_car)}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {data.mtd.basis === "cumulative-snapshot"
                ? `From the accepted month-to-date report as of ${data.mtd.as_of}${
                    data.mtd.stale ? ` · ${data.mtd.days_behind} day(s) behind the shop day, coverage incomplete` : ""
                  }`
                : data.mtd.basis === "none"
                  ? "No confirmed records for this month yet. Nothing is assumed to be zero."
                  : `Sum of ${data.mtd.covered_days} confirmed day(s) through ${data.mtd.as_of}${
                      data.mtd.missing_days > 0 ? ` · ${data.mtd.missing_days} day(s) still missing` : ""
                    }`}
            </p>
          </section>
          )}

          {(shows("monthly_chart") || shows("ytd")) && (
          <section className="grid gap-4 lg:grid-cols-3">
            {shows("monthly_chart") && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-display"><BarChart3 className="h-5 w-5 text-secondary" />Monthly gross profit</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {!monthlyByYear ? (
                  <p className="text-sm text-muted-foreground">
                    No monthly totals yet. They appear as daily entries and reports are confirmed.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyByYear.rows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <ChartTooltip formatter={(v) => formatCurrency(typeof v === "number" ? v : null)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {monthlyByYear.years.map((year, i) => (
                        <Line
                          key={year}
                          type="monotone"
                          dataKey={year}
                          name={year}
                          stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Months with no saved gross profit are left blank, never drawn as zero.
                </p>
              </CardContent>
            </Card>
            )}

            {shows("ytd") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-display"><Trophy className="h-5 w-5 text-primary" />Year to date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Gross profit" value={formatCurrency(data.ytd.gross_profit)} />
                <Row label="Tires sold" value={formatCount(data.ytd.tires_sold)} />
                <Row label="Car count" value={formatCount(data.ytd.car_count)} />
                <Row label="GP per car" value={formatCurrency(data.ytd.gp_per_car)} />
                {data.ytd.gp_per_car_note && (
                  <p className="text-xs text-muted-foreground">{data.ytd.gp_per_car_note}</p>
                )}
                <p className="pt-2 text-xs text-muted-foreground">
                  {data.ytd.basis === "cumulative-snapshot"
                    ? `From the accepted year-to-date report as of ${data.ytd.as_of}.`
                    : data.ytd.basis === "none"
                      ? "No confirmed records for this year yet."
                      : `Sum of ${data.ytd.covered_days} confirmed daily record(s) through ${data.ytd.as_of}, of ${
                          data.ytd.covered_days + data.ytd.missing_days
                        } day(s) elapsed.`}{" "}
                  Cumulative reports are never added to daily totals.
                </p>
                <div className="border-t pt-2">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    Same period last year
                  </p>
                  <Row label="Gross profit" value={formatCurrency(data.ytdLastYear.gross_profit)} />
                  <Row label="Cars" value={formatCount(data.ytdLastYear.car_count)} />
                </div>
              </CardContent>
            </Card>
            )}
          </section>
          )}


        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
