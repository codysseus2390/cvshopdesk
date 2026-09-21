import { CedarLogo } from "@/components/cedar-logo";
import { TvClock } from "./tv-clock";

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
    <header className="flex items-center justify-between gap-6">
      <CedarLogo className="h-14 w-auto shrink-0" />
      <div className="flex-1 text-center">
        <p className="font-display text-3xl font-bold uppercase tracking-[0.2em] text-primary">
          {title}
        </p>
        {alert && <p className="mt-1 text-sm font-semibold text-destructive">{alert}</p>}
      </div>
      <TvClock timezone={timezone} />
    </header>
  );
}
