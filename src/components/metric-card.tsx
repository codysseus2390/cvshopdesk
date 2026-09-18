import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";
import { CarFront, CircleDollarSign, Gauge, CircleDashed, Wrench } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  size = "normal",
  appearance = "default",
  periodLabel,
  supportingValues,
  sparkline,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  size?: "normal" | "tv";
  appearance?: "default" | "dashboard";
  periodLabel?: string;
  supportingValues?: ReadonlyArray<{ label: string; value: string; hint?: string | undefined }>;
  sparkline?: ReactNode;
}) {
  const notUpdated = value === "Not updated" || value === "Unavailable" || value === "—";
  const Icon = label.toLowerCase().includes("productivity")
    ? Wrench
    : label.toLowerCase().includes("profit")
      ? CircleDollarSign
      : label.toLowerCase().includes("tire")
        ? CircleDashed
        : label.toLowerCase().includes("car count")
          ? CarFront
          : Gauge;
  const greenAccent =
    label.toLowerCase().includes("profit") || label.toLowerCase().includes("car count");
  if (appearance === "dashboard") {
    return (
      <Card
        className={`min-w-0 rounded-xl border bg-card shadow-card transition-shadow hover:shadow-elevated ${greenAccent ? "border-secondary/30" : "border-primary/30"}`}
      >
        <CardContent className="flex min-h-[13.5rem] h-full flex-col p-4 sm:p-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ${greenAccent ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">{label}</p>
              {periodLabel && <p className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</p>}
            </div>
          </div>
          <p
            className={`mt-2 break-words font-display font-bold tracking-tight tabular-nums ${notUpdated ? "text-xl text-muted-foreground" : "text-4xl leading-none text-foreground xl:text-5xl"}`}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>}
          {supportingValues && (
            <dl className="mt-2 space-y-1.5 border-t border-border/70 pt-2">
              {supportingValues.map((period) => (
                <div key={period.label}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <dt className="text-sm font-medium text-muted-foreground">{period.label}</dt>
                    <dd className="text-base font-bold leading-tight tracking-tight tabular-nums text-foreground">
                      {period.value}
                    </dd>
                  </div>
                  {period.hint && (
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {period.hint}
                    </p>
                  )}
                </div>
              ))}
            </dl>
          )}
          {sparkline}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card
      className={`relative overflow-hidden border-t-[3px] shadow-card hover:shadow-elevated ${greenAccent ? "border-t-secondary" : "border-t-primary"}`}
    >
      <CardContent className={size === "tv" ? "p-8" : "min-h-40 p-5 sm:min-h-0 sm:p-6"}>
        <div className="flex items-center gap-4">
          <span
            className={`flex shrink-0 items-center justify-center rounded-full ${size === "tv" ? "h-14 w-14" : "h-12 w-12"} ${greenAccent ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}
          >
            <Icon className={size === "tv" ? "h-7 w-7" : "h-5 w-5"} />
          </span>
          <p
            className={
              size === "tv"
                ? "text-xl font-semibold uppercase text-muted-foreground"
                : "text-sm font-bold uppercase text-muted-foreground"
            }
          >
            {label}
          </p>
        </div>
        <p
          className={`font-display font-bold ${
            size === "tv" ? "mt-4 text-6xl" : "mt-5 text-5xl leading-none"
          } ${notUpdated ? "text-muted-foreground" : "text-foreground"}`}
        >
          {value}
        </p>
        {hint && (
          <p
            className={
              size === "tv"
                ? "mt-3 text-lg text-muted-foreground"
                : "mt-3 text-xs leading-relaxed text-muted-foreground"
            }
          >
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
