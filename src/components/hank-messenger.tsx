import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const HankChat = lazy(() =>
  import("@/components/shop-ai/hank-chat").then((module) => ({ default: module.HankChat })),
);

export function HankMessenger() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full bg-card"
          aria-label="Chat with Hank"
          title="Chat with Hank"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        aria-label="Hank AI chat"
        className="flex h-[min(38rem,var(--radix-popover-content-available-height))] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[28rem] flex-col overflow-hidden rounded-2xl p-0 shadow-elevated motion-reduce:animate-none"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-semibold">Hank</h2>
            <p className="text-xs text-muted-foreground">Your shop assistant</p>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <Link
              to="/shop-ai"
              aria-label="Open full Hank conversation"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close Hank chat"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <Suspense
          fallback={
            <p className="p-4 text-sm text-muted-foreground" role="status">
              Loading Hank…
            </p>
          }
        >
          <HankChat compact />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
