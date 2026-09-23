import { CedarLogo } from "@/components/cedar-logo";
import { TvClock } from "./tv-clock";

/**
 * Full-bleed top bar, divided into flush cells (brand / title / clock) by
 * hairline rules instead of floating with page padding.
 */
export function TvHeader({
  title,
  timezone,
  alert,
}: {
  title: string;
  timezone?: string | undefined;
  /** Shown only when something is actually wrong — kept small and out of the way. */
  alert?: string | null;
}) {
  return (
    <header className="tv-header">
      <div className="tv-brand">
        <CedarLogo className="tv-brand-logo" />
        <p>Trusted care keeps you rolling</p>
      </div>
      <div className="tv-heading">
        <h1>
          {title === "Shop numbers" ? (
            <>
              Shop <span>numbers</span>
            </>
          ) : (
            <>
              Today's <span>shop</span>
            </>
          )}
        </h1>
        <p className="tv-tagline">Vehicles · People · Further together</p>
        {alert && <p className="mt-1.5 text-sm font-bold text-destructive">{alert}</p>}
      </div>
      <TvClock timezone={timezone} />
    </header>
  );
}
