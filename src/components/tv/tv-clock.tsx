import { useEffect, useState } from "react";

/**
 * Ticks on its own second-by-second timer so the clock updates without
 * re-rendering the rest of the TV screen (which only needs to redraw on
 * data refresh / screen rotation, not every second).
 *
 * Renders on an opaque plate rather than over the moving background: a
 * translucent clock washed out completely on the actual shop TV.
 */
export function TvClock({ timezone }: { timezone?: string | undefined }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stamp = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const [time, meridiem] = stamp.split(/\s+/);
  const date = now
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone,
    })
    .toUpperCase()
    .replace(",", " ·");

  return (
    <div className="tv-clock-plate flex min-w-[15rem] flex-col items-end justify-center border-l border-border px-8 py-3">
      <p className="flex items-baseline gap-2 font-display text-[3.9rem] font-bold leading-[0.92] tracking-tight tabular-nums text-[#fffdf8]">
        {time}
        {meridiem && (
          <span className="font-display text-xl font-semibold tracking-[0.1em] text-primary">
            {meridiem}
          </span>
        )}
      </p>
      <p className="mt-1 font-display text-[1.05rem] font-semibold tracking-[0.22em] text-[oklch(0.86_0.018_75)]">
        {date}
      </p>
    </div>
  );
}
