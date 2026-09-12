import { Card, CardContent } from "@/components/ui/card";
import { CarFront, CircleDollarSign, Gauge, CircleDashed } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  size = "normal",
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  size?: "normal" | "tv";
}) {
  const notUpdated = value === "Not updated" || value === "Unavailable";
  const Icon = label.toLowerCase().includes("profit")
    ? CircleDollarSign
    : label.toLowerCase().includes("tire")
      ? CircleDashed
      : label.toLowerCase().includes("car count")
        ? CarFront
        : Gauge;
  const greenAccent = label.toLowerCase().includes("profit") || label.toLowerCase().includes("car count");
  return (
    <Card className={`relative overflow-hidden border-t-[3px] shadow-card hover:shadow-elevated ${greenAccent ? "border-t-secondary" : "border-t-primary"}`}>
      <CardContent className={size === "tv" ? "p-8" : "min-h-40 p-5 sm:min-h-0 sm:p-6"}>
        <div className="flex items-center gap-4">
          <span className={`flex shrink-0 items-center justify-center rounded-full ${size === "tv" ? "h-14 w-14" : "h-12 w-12"} ${greenAccent ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
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
          <p className={size === "tv" ? "mt-3 text-lg text-muted-foreground" : "mt-3 text-xs leading-relaxed text-muted-foreground"}>
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
