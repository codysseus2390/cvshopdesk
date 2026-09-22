import { CarFront, CircleDashed, CircleDollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TvMetricCard, type TvPeriodValue } from "./tv-metric-card";
import { TvProductivityCard } from "./tv-productivity-card";
import { cn } from "@/lib/utils";
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
    <div className="tv-slab grid min-h-0 flex-1 grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl border border-border">
      {metrics.map((metric, index) => (
        <TvMetricCard
          key={metric.label}
          label={metric.label}
          icon={metric.icon}
          accent={metric.accent}
          month={period("This month", metric.values[0], metric.format)}
          week={period("This week", metric.values[1], metric.format)}
          previousDay={period("Previous day", metric.values[2], metric.format)}
          // Hairline rules between cells instead of gaps, so the panel reads as
          // one instrument cluster.
          className={cn(index % 2 === 0 && "border-r border-border", index < 2 && "border-b")}
        />
      ))}
      {/* Fourth cell: per-mechanic breakdown, matching the dashboard panel. */}
      <TvProductivityCard
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
