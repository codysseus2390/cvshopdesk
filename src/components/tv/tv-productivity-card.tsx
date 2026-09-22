import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProductivity } from "@/lib/productivity-math";
import type { useDashboard } from "@/routes/_authenticated/hub";

type DashboardData = NonNullable<ReturnType<typeof useDashboard>["data"]>;
/** Exactly the shape the dashboard query already returns for mechanics. */
export type TvMechanics = DashboardData["mechanics"];

/**
 * Per-mechanic productivity, laid out like the dashboard panel of the same
 * name — one row per mechanic, one column per reporting period — but wearing
 * the TV surface instead of the light card.
 *
 * The shop-wide totals the TV used to show as a single KPI are kept as a
 * summary row at the bottom rather than dropped.
 */
export function TvProductivityCard({
  mechanics,
  shop,
  className,
}: {
  mechanics: TvMechanics | undefined;
  /** Shop-wide productivity, in the same [previousDay, week, month] order. */
  shop: [number | null, number | null, number | null];
  className?: string;
}) {
  const names = mechanics?.names ?? [];

  return (
    <div
      className={cn("tv-accent-wash relative flex min-w-0 flex-col px-8 py-6", className)}
      style={{ "--tv-accent": "var(--color-secondary)" } as React.CSSProperties}
    >
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Wrench className="h-5 w-5" />
        </span>
        <p className="font-display text-lg font-semibold uppercase tracking-[0.1em] text-[oklch(0.84_0.02_72)]">
          Mechanic productivity
        </p>
        <p className="ml-auto text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Production % by reporting period
        </p>
      </div>

      <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
        <table className="h-full w-full table-fixed border-collapse">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <th className="pb-2 text-left font-bold">Mechanic</th>
              <th className="pb-2 text-right font-bold">Prev day</th>
              <th className="pb-2 text-right font-bold">This wk</th>
              <th className="pb-2 text-right font-bold">Month</th>
            </tr>
          </thead>
          <tbody>
            {names.length === 0 && (
              <tr>
                <td colSpan={4} className="pt-4 text-lg text-muted-foreground">
                  Awaiting shop numbers
                </td>
              </tr>
            )}
            {names.map((name, index) => (
              <MechanicRow
                key={name}
                name={name}
                accent={index % 2 ? "primary" : "secondary"}
                previousDay={mechanics?.previous_day[name] ?? null}
                week={mechanics?.week[name] ?? null}
                month={mechanics?.month[name] ?? null}
              />
            ))}
            <MechanicRow
              name="Shop"
              accent="shop"
              previousDay={shop[0]}
              week={shop[1]}
              month={shop[2]}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

const AVATAR: Record<string, string> = {
  primary: "bg-primary/25 text-[oklch(0.86_0.13_45)]",
  secondary: "bg-secondary/25 text-[oklch(0.85_0.12_130)]",
  shop: "bg-[oklch(0.32_0.012_60)] text-[oklch(0.86_0.02_72)]",
};

function MechanicRow({
  name,
  accent,
  previousDay,
  week,
  month,
}: {
  name: string;
  accent: "primary" | "secondary" | "shop";
  previousDay: number | null | undefined;
  week: number | null | undefined;
  month: number | null | undefined;
}) {
  // Clamped only for the bar's width — the printed value stays as reported.
  const bar =
    typeof month === "number" && Number.isFinite(month) ? Math.max(0, Math.min(100, month)) : null;

  return (
    <tr className={cn("border-t border-border", accent === "shop" && "border-t-2 border-t-border")}>
      <th className="py-2 text-left align-middle">
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-base font-bold",
              AVATAR[accent],
            )}
          >
            {name.slice(0, 1)}
          </span>
          <span className="truncate font-display text-xl font-bold text-[#fffdf8]">{name}</span>
        </span>
      </th>
      <PeriodCell value={previousDay} />
      <PeriodCell value={week} />
      <td className="py-2 text-right align-middle">
        <span className="block font-display text-[1.7rem] font-bold leading-none tabular-nums text-[#fffdf8]">
          {formatProductivity(month ?? null)}
        </span>
        {bar !== null && (
          <span className="gauge-fill ml-auto mt-1.5 block h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
            <span
              className={cn(
                "block h-full rounded-full",
                accent === "primary" ? "bg-primary" : "bg-secondary",
              )}
              style={{ width: `${bar}%` }}
            />
          </span>
        )}
      </td>
    </tr>
  );
}

function PeriodCell({ value }: { value: number | null | undefined }) {
  const empty = value === null || value === undefined;
  return (
    <td
      className={cn(
        "py-2 text-right align-middle font-display text-xl font-bold tabular-nums",
        empty ? "text-muted-foreground/70" : "text-[oklch(0.88_0.018_76)]",
      )}
    >
      {formatProductivity(value ?? null)}
    </td>
  );
}
