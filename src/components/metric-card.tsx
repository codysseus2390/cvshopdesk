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
    <Card>
      <CardContent className={size === "tv" ? "p-8" : "p-6"}>
        <p
          className={
            size === "tv"
              ? "text-xl font-semibold uppercase tracking-wide text-muted-foreground"
              : "text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          }
        >
          {label}
        </p>
        <p
          className={`font-display font-bold tracking-tight ${
            size === "tv" ? "mt-3 text-6xl" : "mt-2 text-3xl"
          } ${notUpdated ? "text-muted-foreground" : "text-foreground"}`}
        >
          {value}
        </p>
        {hint && (
          <p className={size === "tv" ? "mt-2 text-lg text-muted-foreground" : "mt-1 text-xs text-muted-foreground"}>
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
