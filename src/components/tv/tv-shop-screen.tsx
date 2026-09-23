import { useEffect, useRef, type ReactNode } from "react";
import { TvStatusBadge } from "./tv-status-badge";
import { checkinElapsed, tvTime, workflowStatus, type TvBoardJob } from "@/lib/tv-board";

/** Preserve the position across rotations and pause at either end before reversing. */
function ScrollingList({
  children,
  paused,
  label,
}: {
  children: ReactNode;
  paused: boolean;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  useEffect(() => {
    if (paused) return;
    let frame = 0;
    let previous = 0;
    let holdUntil = 0;
    let position = ref.current?.scrollTop ?? 0;
    const step = (time: number) => {
      const node = ref.current;
      const delta = previous ? Math.min(time - previous, 100) : 0;
      previous = time;
      if (node && time >= holdUntil) {
        const max = node.scrollHeight - node.clientHeight;
        if (max > 0) {
          position = Math.max(0, Math.min(max, position + direction.current * delta * 0.018));
          node.scrollTop = position;
          if (position >= max || position <= 0) {
            direction.current *= -1;
            holdUntil = time + 2000;
          }
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [paused]);
  return (
    <div
      ref={ref}
      aria-label={label}
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]"
    >
      {children}
    </div>
  );
}

export function TvShopScreen({
  rows,
  nextUp,
  timezone,
  now,
  paused,
}: {
  rows: TvBoardJob[];
  nextUp: TvBoardJob[];
  timezone: string;
  now: number;
  paused: boolean;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)] gap-4">
      <section className="tv-slab flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 className="font-display text-2xl font-bold text-primary">Next up & in shop</h2>
          <p className="text-sm text-muted-foreground">Live workflow · timers start at check-in</p>
        </div>
        <ScrollingList paused={paused} label="Next up and in shop customers">
          {nextUp.length === 0 && (
            <p className="p-6 text-muted-foreground">
              No active visits or appointments in the next 12 hours.
            </p>
          )}
          {nextUp.map((job) => (
            <div
              key={job.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-6 py-4 last:border-0 even:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold text-[#fffdf8]">
                  {job.customer_name ?? "Customer not recorded"}
                </p>
                <p className="text-lg text-muted-foreground">
                  {job.vehicle_label ?? "Vehicle not recorded"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {job.requested_service ?? "Service not recorded"}
                </p>
              </div>
              <div className="text-right">
                <TvStatusBadge status={workflowStatus(job)} />
                <p className="mt-2 font-display text-xl font-bold tabular-nums text-[#fffdf8]">
                  {!job.arrival_at && !job.appointment_at
                    ? "Time unavailable"
                    : checkinElapsed(job.arrival_at, now)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {job.arrival_at
                    ? "since check-in"
                    : job.appointment_at
                      ? tvTime(job.appointment_at, timezone)
                      : "Check-in time unavailable"}
                </p>
              </div>
            </div>
          ))}
        </ScrollingList>
      </section>
      <section className="tv-slab mt-auto flex h-[80%] min-h-0 flex-col overflow-hidden rounded-2xl border border-border">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="font-display text-xl font-bold text-primary">Schedule</h2>
          <p className="text-sm text-muted-foreground">Next 12 hours · shop time</p>
        </div>
        <ScrollingList paused={paused} label="Appointment schedule">
          {rows.length === 0 && (
            <p className="p-5 text-muted-foreground">No appointments in the next 12 hours.</p>
          )}
          {rows.map((job) => (
            <div
              key={job.id}
              className="border-b border-border px-5 py-3 last:border-0 even:bg-white/[0.02]"
            >
              <p className="font-display text-lg font-bold tabular-nums text-primary">
                {tvTime(job.appointment_at, timezone)}
              </p>
              <p className="font-display text-xl font-bold text-[#fffdf8]">
                {job.customer_name ?? "Customer not recorded"}
              </p>
              <p className="text-base text-muted-foreground">
                {job.vehicle_label ?? "Vehicle not recorded"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {job.requested_service ?? "Service not recorded"}
              </p>
            </div>
          ))}
        </ScrollingList>
      </section>
    </div>
  );
}
