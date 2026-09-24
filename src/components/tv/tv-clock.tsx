import { useEffect, useState } from "react";

/**
 * Ticks on its own second-by-second timer so the clock updates without
 * re-rendering the rest of the TV screen (which only needs to redraw on
 * data refresh / screen rotation, not every second).
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
    <div className="tv-clock">
      <p className="tv-clock-time">
        {time}
        {meridiem && <span className="tv-clock-meridiem">{meridiem}</span>}
      </p>
      <p className="tv-clock-date">{date}</p>
    </div>
  );
}
