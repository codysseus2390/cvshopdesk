import { Check, Database, Loader2, TriangleAlert } from "lucide-react";

export interface ToolActivityItem {
  name: string;
  sourceLabel: string;
  ok: boolean;
}

/** Small chips showing which approved shop data sources a turn used. */
export function ToolActivity({
  items,
  running,
}: {
  items?: ToolActivityItem[] | undefined;
  running?: string | null | undefined;
}) {
  if (!running && (!items || items.length === 0)) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {running && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking {running}
        </span>
      )}
      {(items ?? []).map((item, index) => (
        <span
          key={`${item.name}-${index}`}
          className={
            item.ok
              ? "inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-foreground"
              : "inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive"
          }
        >
          {item.ok ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
          <Database className="h-3 w-3 opacity-70" />
          {item.sourceLabel}
        </span>
      ))}
    </div>
  );
}

/** "Shop AI is thinking" indicator. */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Shop AI is thinking…
    </div>
  );
}
