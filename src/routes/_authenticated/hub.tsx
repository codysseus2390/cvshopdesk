import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, Trophy } from "lucide-react";
import { getDashboard } from "@/lib/metrics.functions";
import { AppShell } from "@/components/app-shell";
import { AccessGate, useShopContext } from "@/components/access-gate";
import { MetricCard } from "@/components/metric-card";
import { DashboardMiddleRow, SystemSettingsPanel } from "@/components/dashboard-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount, formatCurrency, gpPerCar } from "@/lib/metrics-math";
import { usePermissions } from "@/components/use-permissions";
import {
  buildDashboardChart,
  buildDashboardSparkline,
  type DashboardChartMetric,
} from "@/lib/dashboard-chart";
import { formatDashboardWeekRange, weeklyGoalNote } from "@/lib/dashboard-week";

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
      sparkline: <KpiSparkline trend={data ? buildDashboardSparkline(data.monthly, key === "gp_per_car" ? "gross_profit_per_car" : key, data.today) : null} green={key === "gross_profit" || key === "car_count"} />,
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
    "var(--color-secondary)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  const yearColor = (year: string, index: number) => year === monthlyByYear?.currentYear
    ? "var(--color-primary)" : YEAR_COLORS[index % YEAR_COLORS.length];
  const partialMonth = monthlyByYear?.rows.find((row) => row.monthKey === monthlyByYear.currentMonth);
  const partialValue = partialMonth?.[`${monthlyByYear?.currentYear}__mtd`];

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

          <DashboardMiddleRow mechanics={data.mechanics} />



          {(shows("monthly_chart") || shows("ytd")) && (
          <section className="grid items-start gap-4 xl:grid-cols-12">
            {shows("monthly_chart") && (
            <Card className="min-w-0 rounded-xl border-secondary/25 xl:col-span-7">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-2 sm:p-4 sm:pb-2">
                <CardTitle className="flex items-center gap-2 font-body text-base font-semibold"><BarChart3 className="h-5 w-5 text-secondary" />Monthly {chartMetricDef.label === "Gross profit" ? "Gross Profit" : chartMetricDef.label}</CardTitle>
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
              <CardContent className="px-4 pb-4 sm:px-4 sm:pb-4">
                {!monthlyByYear ? (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-5 text-sm text-muted-foreground">
                    No monthly totals yet. They appear as daily entries and reports are confirmed.
                  </p>
                ) : (
                  <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <ul aria-label="Chart legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {monthlyByYear.years.map((year, i) => (
                        <li key={year} className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ backgroundColor: yearColor(year, i) }} />
                          {year}{year === monthlyByYear.currentYear ? " · completed months" : ""}
                        </li>
                      ))}
                    </ul>
                    {typeof partialValue === "number" && (
                      <p className="rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-xs text-muted-foreground">
                        {partialMonth?.month} {monthlyByYear.currentYear} · partial MTD <strong className="ml-1 tabular-nums text-foreground">{chartMetricDef.currency ? formatCurrency(partialValue) : formatCount(partialValue)}</strong>
                      </p>
                    )}
                  </div>
                  <div className="h-60 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart accessibilityLayer data={monthlyByYear.rows} margin={{ top: 8, right: 12, left: 0, bottom: 6 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" strokeOpacity={0.65} vertical={false} />
                      <XAxis dataKey="month" interval={0} angle={-45} textAnchor="end" height={38} tickMargin={8} padding={{ left: 6, right: 6 }} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                      <YAxis
                        width={48}
                        tickCount={5}
                        domain={[0, "auto"]}
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1, ...(chartMetricDef.currency ? { style: "currency", currency: "USD" } : {}) }).format(v)}
                      />
                      <ChartTooltip
                        content={<MonthlyChartTooltip currency={chartMetricDef.currency} />}
                        cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "3 4", strokeOpacity: 0.4 }}
                      />
                      {monthlyByYear.years.map((year, i) => (
                        <Line
                          key={year}
                          type="linear"
                          dataKey={year}
                          name={year}
                          stroke={yearColor(year, i)}
                          strokeWidth={3}
                          dot={{ r: 3, strokeWidth: 2, fill: "var(--color-card)" }}
                          activeDot={{ r: 5, strokeWidth: 2 }}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                  </>
                )}
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  January through December, using the same confirmed monthly records as the Numbers page. The current
                  month is partial and shown separately above. The current-year line stops before the current month; missing and future values stay blank.
                </p>
              </CardContent>
            </Card>
            )}

            {shows("ytd") && (
            <Card className="min-w-0 rounded-xl border-primary/25 xl:col-span-2">
              <CardHeader className="p-4 pb-2 sm:p-4 sm:pb-2">
                <CardTitle className="flex items-center gap-2 font-body text-base font-semibold"><Trophy className="h-5 w-5 text-primary" />Year to date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 px-4 pb-4 text-sm sm:px-4 sm:pb-4">
                <Row label="Gross profit" value={formatCurrency(data.ytd.gross_profit)} />
                <Row label="Tires sold" value={formatCount(data.ytd.tires_sold)} />
                <Row label="Car count" value={formatCount(data.ytd.car_count)} />
                <Row label="GP per car" value={formatCurrency(data.ytd.gp_per_car)} />
                {data.ytd.gp_per_car_note && (
                  <p className="text-xs leading-snug text-muted-foreground">{data.ytd.gp_per_car_note}</p>
                )}
                <p className="pt-1 text-xs leading-snug text-muted-foreground">
                  {data.ytd.basis === "cumulative-snapshot"
                    ? `From the accepted year-to-date report as of ${data.ytd.as_of}.`
                    : data.ytd.basis === "none"
                      ? "No confirmed records for this year yet."
                      : `Sum of ${data.ytd.covered_days} confirmed daily record(s) through ${data.ytd.as_of}, of ${
                          data.ytd.covered_days + data.ytd.missing_days
                        } day(s) elapsed.`}{" "}
                  Cumulative reports are never added to daily totals.
                </p>
                <div className="border-t border-border/70 pt-2">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    Same period last year
                  </p>
                  <Row label="Gross profit" value={formatCurrency(data.ytdLastYear.gross_profit)} />
                  <Row label="Cars" value={formatCount(data.ytdLastYear.car_count)} />
                </div>
              </CardContent>
            </Card>
            )}

            {shows("settings") && <div className="xl:col-span-3"><SystemSettingsPanel /></div>}
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
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function KpiSparkline({ trend, green }: { trend: ReturnType<typeof buildDashboardSparkline>; green: boolean }) {
  const enoughData = trend && trend.points.filter((point) => point.value !== null).length >= 2;
  const color = green ? "var(--color-secondary)" : "var(--color-primary)";
  return (
    <div className="mt-auto pt-2" aria-label={enoughData ? `Completed monthly trend for ${trend.year}; missing months are gaps` : "Monthly trend unavailable: not enough completed monthly values"}>
      {enoughData ? (
        <>
          <div className="h-10" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.points} margin={{ top: 3, right: 2, bottom: 2, left: 2 }}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line type="linear" dataKey="value" stroke={color} strokeWidth={2.25} dot={{ r: 2, fill: color, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground">Completed months · {trend.year}</p>
        </>
      ) : <p className="border-t border-border/40 pt-2 text-[11px] leading-tight text-muted-foreground">Monthly trend unavailable</p>}
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
  const visible = payload?.filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value)) ?? [];
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
          <p key={String(entry.name)} className="flex items-center gap-2 tabular-nums">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {name}: {currency ? formatCurrency(value) : formatCount(value)}
            {String(entry.name).endsWith(" MTD") ? " · Month to date" : ""}
          </p>
        );
      })}
    </div>
  );
}

