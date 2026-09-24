import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
export type TvPeriodValue = { label: string; value: string; empty: boolean };
/** Missing values stay absent across all three reporting periods. */
export function TvMetricCard({
  label,
  icon: Icon,
  accent = "primary",
  month,
  week,
  previousDay,
  className,
}: {
  label: string;
  icon: LucideIcon;
  accent?: "primary" | "secondary";
  month: TvPeriodValue;
  week: TvPeriodValue;
  previousDay: TvPeriodValue;
  className?: string;
}) {
  return (
    <section className={cn("tv-number-card", `tv-number-card--${accent}`, className)}>
      <div className="tv-number-card-heading">
        <span className="tv-number-icon">
          <Icon aria-hidden="true" />
        </span>
        <h2>{label}</h2>
        <Icon className="tv-number-watermark" aria-hidden="true" />
      </div>
      <div className="tv-number-periods">
        {[month, week, previousDay].map((period) => (
          <div className="tv-number-period" key={period.label}>
            <p className="tv-number-period-label">{period.label}</p>
            <p
              className={cn(
                "tv-number-value",
                label === "Gross profit" && "tv-number-value--currency",
                period.empty && "tv-number-value--empty",
              )}
              aria-label={period.empty ? `${period.label}: awaiting shop numbers` : undefined}
            >
              {period.empty ? "—" : period.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
