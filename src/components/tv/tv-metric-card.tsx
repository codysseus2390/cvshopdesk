import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TvPeriodValue = { label: string; value: string; empty: boolean };

/**
 * One KPI, three reporting periods, one card — Month is the hero number,
 * Week and Previous Day sit underneath as smaller supporting values. A
 * period with no saved data renders as a quiet dash, never a fabricated 0.
 */
export function TvMetricCard({
  label,
  icon: Icon,
  accent = "primary",
  month,
  week,
  previousDay,
}: {
  label: string;
  icon: LucideIcon;
  accent?: "primary" | "secondary";
  month: TvPeriodValue;
  week: TvPeriodValue;
  previousDay: TvPeriodValue;
}) {
  return (
    <Card
      className={cn(
        "noise-overlay relative overflow-hidden rounded-2xl border-border/80 bg-card shadow-elevated",
        accent === "primary" ? "panel-glow-ember" : "panel-glow-profit",
      )}
    >
      <CardContent className="flex h-full flex-col p-7">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              accent === "primary"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <p className="font-display text-lg font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            This month
          </p>
          {month.empty ? (
            <p className="mt-1 font-display text-2xl font-bold text-muted-foreground/70">
              — <span className="text-base font-semibold normal-case">Awaiting shop numbers</span>
            </p>
          ) : (
            <p className="mt-1 font-display text-6xl font-bold leading-none tracking-tight text-foreground tabular-nums">
              {month.value}
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/70 pt-4">
          {[week, previousDay].map((period) => (
            <div key={period.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {period.label}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-2xl font-bold tabular-nums",
                  period.empty ? "text-muted-foreground/70" : "text-foreground",
                )}
              >
                {period.empty ? "—" : period.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
