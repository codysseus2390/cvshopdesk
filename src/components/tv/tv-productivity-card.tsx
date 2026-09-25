import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { TvFitContent } from "./tv-fit-content";
import { formatProductivity } from "@/lib/productivity-math";
import type { useDashboard } from "@/routes/_authenticated/hub";

type DashboardData = NonNullable<ReturnType<typeof useDashboard>["data"]>;
/** Exactly the shape the dashboard query already returns for mechanics. */
export type TvMechanics = DashboardData["mechanics"];

/**
 * Per-mechanic productivity, laid out like the dashboard panel of the same
 * name — one row per mechanic, one column per reporting period — but wearing
 * the TV surface instead of the light card.
 */
export function TvProductivityCard({
  mechanics,
  className,
}: {
  mechanics: TvMechanics | undefined;
  className?: string;
}) {
  const names = mechanics?.names ?? [];

  return (
    <div
      className={cn(
        "tv-lit-panel tv-metric-panel tv-productivity-panel relative flex min-w-0 flex-col",
        className,
      )}
      data-status="done"
    >
      <div className="tv-metric-heading relative flex items-center gap-3">
        <span className="tv-ring-icon">
          <Wrench className="h-5 w-5" />
        </span>
        <h2>Mechanic productivity</h2>
      </div>

      <TvFitContent className="tv-productivity-table" fullWidth>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
          </colgroup>
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
          </tbody>
        </table>
      </TvFitContent>
    </div>
  );
}

const AVATAR: Record<string, string> = {
  primary: "bg-primary/25 text-[oklch(0.86_0.13_45)]",
  secondary: "bg-secondary/25 text-[oklch(0.85_0.12_130)]",
};

function MechanicRow({
  name,
  accent,
  previousDay,
  week,
  month,
}: {
  name: string;
  accent: "primary" | "secondary";
  previousDay: number | null | undefined;
  week: number | null | undefined;
  month: number | null | undefined;
}) {
  return (
    <tr className="border-t border-border">
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
          <span className="break-words font-display text-xl font-bold text-[#fffdf8]">{name}</span>
        </span>
      </th>
      <PeriodCell value={previousDay} />
      <PeriodCell value={week} />
      <td className="py-2 text-right align-middle">
        <span className="block font-display text-[1.7rem] font-bold leading-none tabular-nums text-[#fffdf8]">
          {formatProductivity(month ?? null)}
        </span>
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
