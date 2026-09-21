import { cn } from "@/lib/utils";

function Stat({ dotClassName, children }: { dotClassName: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotClassName)} />
      {children}
    </span>
  );
}

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
    <div className="flex items-center justify-center gap-8 rounded-full border border-border/70 bg-card/80 px-8 py-3 font-display text-lg font-semibold tracking-wide text-foreground">
      <Stat dotClassName="bg-primary">{inShop} IN SHOP</Stat>
      <Stat dotClassName="bg-muted-foreground/60">{upcoming} UPCOMING</Stat>
      <Stat dotClassName="bg-secondary">{done} DONE</Stat>
      {nextAppointment && (
        <>
          <span className="h-5 w-px bg-border" />
          <span className="text-muted-foreground">
            NEXT APPT <span className="text-foreground">{nextAppointment}</span>
          </span>
        </>
      )}
    </div>
  );
}
