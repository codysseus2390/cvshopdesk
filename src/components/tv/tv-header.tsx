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
    <header className="tv-bar flex shrink-0 items-stretch border-b border-border">
      <div className="flex items-center px-7">
        <CedarLogo className="h-12 w-auto shrink-0" />
      </div>
      <div className="flex flex-1 flex-col justify-center border-l border-border px-7 py-4">
        <p className="font-display text-3xl font-bold uppercase leading-none tracking-[0.18em] text-primary">
          {title === "Shop numbers" ? (
            <>
              Shop <span className="tv-title-accent">numbers</span>
            </>
          ) : (
            title
          )}
        </p>
        {alert && <p className="mt-1.5 text-sm font-bold text-destructive">{alert}</p>}
      </div>
      <TvClock timezone={timezone} />
    </header>
  );
}
