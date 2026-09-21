import { cn } from "@/lib/utils";
import { TV_STATUS_LABEL, type TvStatus } from "./tv-status";

const STYLES: Record<TvStatus, string> = {
  upcoming: "bg-muted text-muted-foreground border-border/80",
  in_shop: "bg-primary/15 text-primary border-primary/40",
  done: "bg-secondary/15 text-secondary border-secondary/40",
};

export function TvStatusBadge({ status, className }: { status: TvStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-display text-lg font-bold tracking-wide",
        STYLES[status],
        className,
      )}
    >
      {status === "in_shop" && (
        <span className="live-dot h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
      )}
      {TV_STATUS_LABEL[status]}
    </span>
  );
}
