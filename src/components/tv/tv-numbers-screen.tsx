import { CarFront, CircleDashed, CircleDollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TvMetricCard, type TvPeriodValue } from "./tv-metric-card";
import { TvProductivityCard } from "./tv-productivity-card";
import { formatCount, formatCurrency } from "@/lib/metrics-math";
import type { useDashboard } from "@/routes/_authenticated/hub";

type DashboardData = NonNullable<ReturnType<typeof useDashboard>["data"]>;

function period(
  label: string,
  value: number | null,
  format: (v: number | null) => string,
): TvPeriodValue {
  return { label, value: format(value), empty: value === null };
}

export function TvNumbersScreen({ dashboard }: { dashboard: DashboardData | undefined }) {
  const prev = dashboard?.previousDayRow;
  const week = dashboard?.week;
  const mtd = dashboard?.mtd;

  const prevDayLabel = dashboard?.previousDay
    ? new Date(`${dashboard.previousDay}T00:00:00Z`).toLocaleDateString(undefined, {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      })
    : null;
  // Lead decision: keep the date on screen in both branches (TV has no hover) —
  // "Prev open day · [date]" when the calendar is configured, "Previous day · [date]"
  // when it isn't, matching the hub's date-row pill instead of dropping the date.
  const prevDayCellLabel = prevDayLabel
    ? dashboard?.previousDayKind === "open"
      ? `Prev open day · ${prevDayLabel}`
      : `Previous day · ${prevDayLabel}`
    : "Previous day";

  const metrics: {
    label: string;
    icon: LucideIcon;
    accent: "primary" | "secondary";
    values: [number | null, number | null, number | null];
    format: (v: number | null) => string;
  }[] = [
    {
      label: "Gross profit",
      icon: CircleDollarSign,
      accent: "secondary",
      values: [mtd?.gross_profit ?? null, week?.gross_profit ?? null, prev?.gross_profit ?? null],
      format: formatCurrency,
    },
    {
      label: "Tires sold",
      icon: CircleDashed,
      accent: "primary",
      values: [mtd?.tires_sold ?? null, week?.tires_sold ?? null, prev?.tires_sold ?? null],
      format: formatCount,
    },
    {
      label: "Car count",
      icon: CarFront,
      accent: "secondary",
      values: [mtd?.car_count ?? null, week?.car_count ?? null, prev?.car_count ?? null],
      format: formatCount,
    },
  ];

  return (
    <div className="tv-stage grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-4">
      {metrics.map((metric) => (
        <TvMetricCard
          key={metric.label}
          label={metric.label}
          icon={metric.icon}
          accent={metric.accent}
          month={period("This month", metric.values[0], metric.format)}
          week={period("This week", metric.values[1], metric.format)}
          previousDay={period(prevDayCellLabel, metric.values[2], metric.format)}
          // Each KPI is its own lit glass panel, angled into the tv-stage.
          className="tv-glow-card"
        />
      ))}
      {/* Fourth cell: per-mechanic breakdown, matching the dashboard panel. */}
      <TvProductivityCard
        className="tv-glow-card"
        mechanics={dashboard?.mechanics}
        shop={[
          dashboard?.previousDayProductivity ?? null,
          week?.mechanic_productivity ?? null,
          mtd?.mechanic_productivity ?? null,
        ]}
      />
    </div>
  );
}
