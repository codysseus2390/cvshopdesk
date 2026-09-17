import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, Trophy } from "lucide-react";
import { getDashboard } from "@/lib/metrics.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount, formatCurrency, gpPerCar } from "@/lib/metrics-math";
import { usePermissions } from "@/components/use-permissions";
import {
  buildDashboardChart,
  type DashboardChartMetric,
} from "@/lib/dashboard-chart";
import { formatDashboardWeekRange, weeklyGoalNote } from "@/lib/dashboard-week";
import { formatProductivity } from "@/lib/productivity-math";

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


type KpiKey = "gross_profit" | "tires_sold" | "car_count" | "gp_per_car";

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

  const previousDayValues = {
    gross_profit: todayGp,
    tires_sold: today?.tires_sold ?? null,
    car_count: todayCars,
    gp_per_car: gpPerCar(todayGp, todayCars),
  };
  const weeklyHint = (key: KpiKey): string | undefined => !data ? undefined : key === "gp_per_car"
    ? data.week.gp_per_car === null ? "Needs weekly gross profit and car count" : undefined
    : weeklyGoalNote(data.week[key], data.week.goals[key]);
  const monthlyHint = (key: KpiKey): string | undefined => {
    if (!data) return undefined;
    if (key === "gp_per_car") return data.mtd.gp_per_car_note ?? goalNote(key, data.mtd[key]);
    const missing = data.mtd.coverage[key].days_missing_value;
    const field = key === "gross_profit" ? "gross profit" : key === "tires_sold" ? "tire count" : "car count";
    return missing > 0 ? `${missing} saved day(s) have no ${field}` : goalNote(key, data.mtd[key]);
  };
  const kpiProps = (key: KpiKey, currency: boolean) => {
    const format = currency ? formatCurrency : formatCount;
    return {
      periodLabel: shows("mtd") ? "Month to date" : "This week",
      value: format((shows("mtd") ? data?.mtd[key] : data?.week[key]) ?? null),
      hint: shows("mtd") ? monthlyHint(key) : weeklyHint(key),
      supportingValues: [
        ...(shows("today") ? [{
          label: "Previous day",
          value: format(previousDayValues[key]),
          hint: key === "gp_per_car" && previousDayValues[key] === null ? "Needs gross profit and car count" : undefined,
        }] : []),
        ...(shows("mtd") ? [{ label: "This week", value: format(data?.week[key] ?? null), hint: weeklyHint(key) }] : []),
      ],
    };
  };
  const monthlySummary = !data ? null : data.mtd.basis === "cumulative-snapshot"
    ? `From the accepted month-to-date report as of ${data.mtd.as_of}${data.mtd.stale ? ` · ${data.mtd.days_behind} day(s) behind the shop day, coverage incomplete` : ""}`
    : data.mtd.basis === "none"
      ? "No confirmed records for this month yet. Nothing is assumed to be zero."
      : `Sum of ${data.mtd.covered_days} confirmed day(s) through ${data.mtd.as_of}${data.mtd.missing_days > 0 ? ` · ${data.mtd.missing_days} day(s) still missing` : ""}`;

  const CHART_METRICS = [
    { key: "gross_profit", label: "Gross profit", currency: true },
    { key: "sales", label: "Sales", currency: true },
    { key: "gross_profit_per_car", label: "GP per car", currency: true },
    { key: "tires_sold", label: "Tires sold", currency: false },
    { key: "car_count", label: "Car count", currency: false },
  ] as const;
  const [chartMetric, setChartMetric] = useState<DashboardChartMetric>("gross_profit");
  const chartMetricDef = CHART_METRICS.find((m) => m.key === chartMetric) ?? CHART_METRICS[0];

  const monthlyByYear = useMemo(() => {
    if (!data) return null;
    return buildDashboardChart(data.monthly, chartMetric, data.today);
  }, [data, chartMetric]);

  const YEAR_COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return (
    <AppShell title="Dashboard" appearance="dashboard">
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
        <div className="space-y-6">
          <section aria-label="Dashboard KPIs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {shows("today") && <span className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Previous day {prevDayLabel}
                </span>}
                <span>This week {formatDashboardWeekRange(data.week.from, data.week.through)}</span>
              </div>
              {shows("today") && (perms.can("edit_dashboard_numbers") ? (
                <Button asChild size="sm" className="h-10 rounded-lg px-4 text-sm shadow-sm">
                  <Link to="/entry">Enter today's numbers</Link>
                </Button>
              ) : (
                <Button size="sm" disabled className="h-10 rounded-lg px-4 text-sm" title="You don't have permission to enter numbers.">
                  Enter today's numbers
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard appearance="dashboard" label="Gross profit" {...kpiProps("gross_profit", true)} />
              <MetricCard appearance="dashboard" label="Tires sold" {...kpiProps("tires_sold", false)} />
              <MetricCard appearance="dashboard" label="Car count" {...kpiProps("car_count", false)} />
              <MetricCard appearance="dashboard" label="GP per car" {...kpiProps("gp_per_car", true)} />
            </div>
            <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {shows("today") && !today && <p>No confirmed entry for the previous day yet. Nothing is assumed to be zero.</p>}
              {shows("mtd") && monthlySummary && <p>{monthlySummary}</p>}
            </div>
          </section>

          <section aria-labelledby="mechanic-production-heading">
            <Card className="rounded-xl border border-primary/25 shadow-card">
              <CardContent className="p-3 sm:p-3">
                <h2 id="mechanic-production-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Trophy className="h-4 w-4" /></span>
                  Mechanic production
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-xs sm:table-auto">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-1.5 pr-2 font-medium">Mechanic</th>
                        <th className="pb-1.5 pr-2 text-right font-medium">Previous day</th>
                        <th className="pb-1.5 pr-2 text-right font-medium">This week</th>
                        <th className="pb-1.5 text-right font-medium">Month to date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.mechanics.names.map((technician) => (
                        <tr key={technician} className="border-b border-border/60 last:border-0">
                          <th className="py-1 pr-2 text-left font-semibold">{technician}</th>
                          <td className="py-1 pr-2 text-right tabular-nums">{formatProductivity(data.mechanics.previous_day[technician] ?? null)}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{formatProductivity(data.mechanics.week[technician] ?? null)}</td>
                          <td className="py-1 text-right tabular-nums">{formatProductivity(data.mechanics.month[technician] ?? null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Production percentages entered for each reporting period. A dash means not updated.
                </p>
              </CardContent>
            </Card>
          </section>

          {(shows("monthly_chart") || shows("ytd")) && (
          <section className="grid gap-4 lg:grid-cols-3">
            {shows("monthly_chart") && (
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
                <CardTitle className="flex items-center gap-2 font-display"><BarChart3 className="h-5 w-5 text-secondary" />Monthly {chartMetricDef.label.toLowerCase()}</CardTitle>
                <select
                  aria-label="Chart metric"
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {CHART_METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </CardHeader>
              <CardContent className="h-64">
                {!monthlyByYear ? (
                  <p className="text-sm text-muted-foreground">
                    No monthly totals yet. They appear as daily entries and reports are confirmed.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyByYear.rows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => (chartMetricDef.currency ? `$${v}` : `${v}`)}
                      />
                      <ChartTooltip
                        content={<MonthlyChartTooltip currency={chartMetricDef.currency} />}
                      />
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
                      {monthlyByYear.years.map((year, i) => (
                        <Scatter
                          key={`${year}-mtd`}
                          dataKey={`${year}__mtd`}
                          name={`${year} MTD`}
                          fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                          stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                          legendType="none"
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  January through December, using the same confirmed monthly records as the Numbers page. The current
                  month is shown as its actual month-to-date point; future months stay blank.
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

function MonthlyChartTooltip({
  active,
  label,
  payload,
  currency,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ name?: string | number; value?: string | number; color?: string }>;
  currency: boolean;
}) {
  const visible = payload?.filter((entry) => typeof entry.value === "number") ?? [];
  if (!active || visible.length === 0) return null;
  const mtd = visible.find((entry) => String(entry.name).endsWith(" MTD"));
  const title = mtd
    ? `${label} ${String(mtd.name).replace(" MTD", "")} — Month to date`
    : String(label ?? "");

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-elevated">
      <p className="mb-1 font-semibold">{title}</p>
      {visible.map((entry) => {
        const name = String(entry.name).replace(" MTD", "");
        const value = typeof entry.value === "number" ? entry.value : null;
        return (
          <p key={String(entry.name)}>
            {name}: {currency ? formatCurrency(value) : formatCount(value)}
            {String(entry.name).endsWith(" MTD") ? " · Month to date" : ""}
          </p>
        );
      })}
    </div>
  );
}

