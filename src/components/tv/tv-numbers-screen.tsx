import { CarFront, CircleDashed, CircleDollarSign, Wrench } from "lucide-react";
import { TvMetricCard, type TvPeriodValue } from "./tv-metric-card";
import { formatCount, formatCurrency } from "@/lib/metrics-math";
import { formatProductivity } from "@/lib/productivity-math";
import type { useDashboard } from "@/routes/_authenticated/hub";

type DashboardData = NonNullable<ReturnType<typeof useDashboard>["data"]>;

function period(label: string, value: number | null, format: (v: number | null) => string): TvPeriodValue {
  return { label, value: format(value), empty: value === null };
}

export function TvNumbersScreen({ dashboard }: { dashboard: DashboardData | undefined }) {
  const prev = dashboard?.previousDayRow;
  const week = dashboard?.week;
  const mtd = dashboard?.mtd;

  return (
    <div className="grid grid-cols-2 gap-6">
      <TvMetricCard
        label="Gross profit"
        icon={CircleDollarSign}
        accent="secondary"
        month={period("This month", mtd?.gross_profit ?? null, formatCurrency)}
        week={period("This week", week?.gross_profit ?? null, formatCurrency)}
        previousDay={period("Previous day", prev?.gross_profit ?? null, formatCurrency)}
      />
      <TvMetricCard
        label="Tires sold"
        icon={CircleDashed}
        accent="primary"
        month={period("This month", mtd?.tires_sold ?? null, formatCount)}
        week={period("This week", week?.tires_sold ?? null, formatCount)}
        previousDay={period("Previous day", prev?.tires_sold ?? null, formatCount)}
      />
      <TvMetricCard
        label="Car count"
        icon={CarFront}
        accent="secondary"
        month={period("This month", mtd?.car_count ?? null, formatCount)}
        week={period("This week", week?.car_count ?? null, formatCount)}
        previousDay={period("Previous day", prev?.car_count ?? null, formatCount)}
      />
      <TvMetricCard
        label="Mechanic productivity"
        icon={Wrench}
        accent="primary"
        month={period("This month", mtd?.mechanic_productivity ?? null, formatProductivity)}
        week={period("This week", week?.mechanic_productivity ?? null, formatProductivity)}
        previousDay={period(
          "Previous day",
          dashboard?.previousDayProductivity ?? null,
          formatProductivity,
        )}
      />
    </div>
  );
}
