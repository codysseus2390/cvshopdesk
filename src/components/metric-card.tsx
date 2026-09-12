import { Card, CardContent } from "@/components/ui/card";

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
  return (
    <Card className="relative overflow-hidden border-l-4 border-l-primary hover:shadow-elevated">
      <div className="absolute inset-x-0 top-0 h-1 bg-secondary/70" aria-hidden="true" />
      <CardContent className={size === "tv" ? "p-8 pt-9" : "p-5 pt-6 sm:p-6 sm:pt-7"}>
        <p
          className={
            size === "tv"
              ? "text-xl font-semibold uppercase text-muted-foreground"
              : "text-xs font-bold uppercase text-muted-foreground"
          }
        >
          {label}
        </p>
        <p
          className={`font-display font-bold ${
            size === "tv" ? "mt-3 text-6xl" : "mt-2 text-3xl"
          } ${notUpdated ? "text-muted-foreground" : "text-foreground"}`}
        >
          {value}
        </p>
        {hint && (
          <p className={size === "tv" ? "mt-3 text-lg text-muted-foreground" : "mt-2 text-xs leading-relaxed text-muted-foreground"}>
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
