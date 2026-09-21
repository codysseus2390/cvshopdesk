import { cn } from "@/lib/utils";
import { TV_STATUS_LABEL, type TvStatus } from "./tv-status";

/** Tuned for a TV across the shop: filled, not tinted-transparent. */
const STYLES: Record<TvStatus, string> = {
  upcoming: "bg-[oklch(0.32_0.012_60)] text-[oklch(0.86_0.02_72)] border-border",
  in_shop: "bg-primary/25 text-[oklch(0.86_0.13_45)] border-primary/55",
  done: "bg-secondary/25 text-[oklch(0.85_0.12_130)] border-secondary/55",
};

export function TvStatusBadge({ status, className }: { status: TvStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1 font-display text-base font-bold tracking-[0.08em]",
        STYLES[status],
        className,
      )}
    >
      {status === "in_shop" && (
        <span className="live-dot h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
      {TV_STATUS_LABEL[status]}
    </span>
  );
}
