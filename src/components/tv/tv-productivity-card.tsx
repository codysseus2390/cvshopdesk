import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProductivity } from "@/lib/productivity-math";
import type { useDashboard } from "@/routes/_authenticated/hub";
type DashboardData = NonNullable<ReturnType<typeof useDashboard>["data"]>;
export type TvMechanics = DashboardData["mechanics"];
export function TvProductivityCard({ mechanics }: { mechanics: TvMechanics | undefined }) {
  const names = mechanics?.names ?? [];
  return (
    <section className="tv-number-card tv-number-card--secondary tv-productivity">
      <div className="tv-number-card-heading">
        <span className="tv-number-icon">
          <Wrench aria-hidden="true" />
        </span>
        <h2>Mechanic productivity</h2>
      </div>
      <div className="tv-productivity-scroll">
        <table>
          <thead>
            <tr>
              <th>Mechanic</th>
              <th>Prev day</th>
              <th>This wk</th>
              <th colSpan={2}>Month</th>
            </tr>
          </thead>
          <tbody>
            {names.length === 0 && (
              <tr>
                <td colSpan={5} className="tv-productivity-empty">
                  Awaiting shop numbers
                </td>
              </tr>
            )}
            {names.map((name, index) => {
              const month = mechanics?.month[name] ?? null;
              const bar =
                typeof month === "number" && Number.isFinite(month)
                  ? Math.max(0, Math.min(100, month))
                  : null;
              return (
                <tr key={name} className={cn(index % 2 === 1 && "tv-mechanic-orange")}>
                  <th scope="row">
                    <span className="tv-mechanic-name">
                      <span className="tv-mechanic-initial" aria-hidden="true">
                        {name.slice(0, 1)}
                      </span>
                      <span>{name}</span>
                    </span>
                  </th>
                  <td>{formatProductivity(mechanics?.previous_day[name] ?? null)}</td>
                  <td>{formatProductivity(mechanics?.week[name] ?? null)}</td>
                  <td>{formatProductivity(month)}</td>
                  <td className="tv-productivity-bar-cell">
                    {bar !== null && (
                      <span className="tv-productivity-track" aria-hidden="true">
                        <span style={{ width: `${bar}%` }} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
