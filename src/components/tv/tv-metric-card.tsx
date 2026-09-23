import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TvPeriodValue = { label: string; value: string; empty: boolean };

/**
 * One KPI, three reporting periods, one cell — Month is the hero number,
 * Week and Previous Day sit underneath as smaller supporting values. A
 * period with no saved data renders as a quiet dash, never a fabricated 0.
 *
 * This is a flush cell inside the numbers slab, not a floating card: the
 * dividing hairlines come from the grid that owns it.
 */
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
    <div
      className={cn("tv-lit-panel tv-metric-panel relative flex min-w-0 flex-col", className)}
      data-status={accent === "primary" ? "in_shop" : "done"}
    >
      <div className="tv-metric-heading relative flex items-center gap-3">
        <span className="tv-ring-icon">
          <Icon className="h-5 w-5" />
        </span>
        <h2>{label}</h2>
      </div>
      <Icon className="tv-metric-watermark" aria-hidden="true" />

      <div className="relative flex flex-1 flex-col justify-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          This month
        </p>
        {month.empty ? (
          <p className="mt-1 font-display text-2xl font-bold text-muted-foreground/70">
            — <span className="text-base font-semibold normal-case">Awaiting shop numbers</span>
          </p>
        ) : (
          <p className="tv-metric-value mt-1 font-display font-bold leading-[0.95] tracking-tight tabular-nums text-[#fffdf8]">
            {month.value}
          </p>
        )}
      </div>

      <div className="relative grid grid-cols-2 gap-4 border-t border-border pt-3.5">
        {[week, previousDay].map((period) => (
          <div key={period.label}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {period.label}
            </p>
            <p
              className={cn(
                "mt-0.5 font-display text-[1.7rem] font-bold leading-tight tabular-nums",
                period.empty ? "text-muted-foreground/70" : "text-[oklch(0.92_0.015_80)]",
              )}
            >
              {period.empty ? "—" : period.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
