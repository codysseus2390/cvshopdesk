import { cn } from "@/lib/utils";

function Stat({ dotClassName, children }: { dotClassName: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5 border-r border-border px-7 py-3.5">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotClassName)} />
      {children}
    </span>
  );
}

/**
 * Full-bleed bottom bar flush to the edge of the screen, divided into cells —
 * the counts on the left, the next appointment anchored right.
 */
export function TvStatusBar({
  inShop,
  upcoming,
  done,
  nextAppointment,
}: {
  inShop: number;
  upcoming: number;
  done: number;
  /** Pre-formatted time, or null when there is no known next appointment. */
  nextAppointment: string | null;
}) {
  return (
    <div className="tv-bar flex shrink-0 items-stretch border-t border-border font-display text-lg font-semibold tracking-[0.1em] text-[oklch(0.9_0.015_78)]">
      <Stat dotClassName="bg-primary">{inShop} IN SHOP</Stat>
      <Stat dotClassName="bg-muted-foreground/60">{upcoming} UPCOMING</Stat>
      <Stat dotClassName="bg-secondary">{done} DONE</Stat>
      <span className="flex-1" />
      {nextAppointment && (
        <span className="flex items-center gap-2.5 border-l border-border px-7 py-3.5">
          <span className="text-muted-foreground">NEXT APPT</span>
          <span className="tabular-nums">{nextAppointment}</span>
        </span>
      )}
    </div>
  );
}
