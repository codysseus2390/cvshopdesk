import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, CircleCheck, Clock, Wrench } from "lucide-react";
import { TV_STATUS_LABEL, type TvStatus } from "./tv-status";
import { checkinElapsed, tvTime, workflowStatus, type TvBoardJob } from "@/lib/tv-board";
import { serviceAccentColor } from "@/lib/service-accent";
import { TvInShopBadge } from "./tv-in-shop-badge";

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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 0;
    let holdUntil = 0;
    let position = ref.current?.scrollTop ?? 0;
    const step = (time: number) => {
      const node = ref.current;
      const delta = previous ? Math.min(time - previous, 100) : 0;
      previous = time;
      if (node && !reducedMotion.matches && time >= holdUntil) {
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
      className="tv-scrolling-list min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]"
    >
      {children}
    </div>
  );
}

const STATUS_ICONS = { in_shop: Wrench, upcoming: Clock, done: CircleCheck };
const STATUS_CAPTIONS = {
  in_shop: "Vehicles being serviced",
  upcoming: "Next in line",
  done: "Completed today",
};

function CustomerCard({
  job,
  status,
  now,
  timezone,
}: {
  job: TvBoardJob;
  status: TvStatus;
  now: number;
  timezone: string;
}) {
  const accent = serviceAccentColor(job.requested_service);
  return (
    <article
      className="tv-customer-card"
      data-status={status}
      style={accent ? ({ "--tv-service-accent": accent } as CSSProperties) : undefined}
    >
      <span className="tv-customer-rail" aria-hidden="true" />
      <div className="tv-customer-heading">
        <h3>{job.customer_name ?? "Customer not recorded"}</h3>
        <span className="tv-customer-badge">{TV_STATUS_LABEL[status]}</span>
      </div>
      <p className="tv-customer-vehicle">{job.vehicle_label ?? "Vehicle not recorded"}</p>
      <p className="tv-customer-service">{job.requested_service ?? "Service not recorded"}</p>
      {status !== "done" && (
        <p className="tv-customer-timer">
          <Clock aria-hidden="true" />
          <span>
            {!job.arrival_at && !job.appointment_at
              ? "Check-in time unavailable"
              : checkinElapsed(job.arrival_at, now)}
          </span>
          {job.arrival_at && <span className="tv-timer-caption">since check-in</span>}
          {!job.arrival_at && job.appointment_at && (
            <span>{tvTime(job.appointment_at, timezone)}</span>
          )}
        </p>
      )}
    </article>
  );
}

export function TvShopScreen({
  rows,
  nextUp,
  done,
  timezone,
  now,
  paused,
}: {
  rows: TvBoardJob[];
  nextUp: TvBoardJob[];
  done: TvBoardJob[];
  timezone: string;
  now: number;
  paused: boolean;
}) {
  const columns: { status: TvStatus; jobs: TvBoardJob[] }[] = [
    { status: "in_shop", jobs: nextUp.filter((job) => workflowStatus(job) === "in_shop") },
    { status: "upcoming", jobs: nextUp.filter((job) => workflowStatus(job) === "upcoming") },
    { status: "done", jobs: done },
  ];
  return (
    <div className="tv-workflow-grid">
      {columns.map(({ status, jobs }) => {
        const Icon = STATUS_ICONS[status];
        return (
          <section
            key={status}
            className="tv-lit-panel tv-workflow-column"
            data-status={status}
            aria-label={TV_STATUS_LABEL[status]}
          >
            <div className="tv-column-header">
              <span className="tv-ring-icon">
                <Icon aria-hidden="true" />
              </span>
              <div>
                <h2>{TV_STATUS_LABEL[status]}</h2>
                <p>{STATUS_CAPTIONS[status]}</p>
              </div>
            </div>
            <ScrollingList paused={paused} label={`${TV_STATUS_LABEL[status]} customers`}>
              {jobs.map((job) => (
                <CustomerCard
                  key={job.id}
                  job={job}
                  status={status}
                  now={now}
                  timezone={timezone}
                />
              ))}
              {jobs.length === 0 && (
                <div className="tv-column-empty">
                  <Icon aria-hidden="true" />
                  <p>
                    {status === "done"
                      ? "Completed visits will appear here."
                      : status === "in_shop"
                        ? "No vehicles in shop right now."
                        : "No upcoming visits in the next 12 hours."}
                  </p>
                </div>
              )}
              {status === "done" && jobs.length > 0 && (
                <div className="tv-column-empty tv-done-message">
                  <CircleCheck aria-hidden="true" />
                  <p>Great work today!</p>
                  <span>More customers on the road with confidence.</span>
                </div>
              )}
            </ScrollingList>
          </section>
        );
      })}
      <section
        className="tv-lit-panel tv-schedule-panel"
        data-status="in_shop"
        aria-label="Today's schedule"
      >
        <div className="tv-column-header">
          <CalendarDays className="tv-schedule-icon" aria-hidden="true" />
          <div>
            <h2>Today's schedule</h2>
            <p>Today · Shop time</p>
          </div>
        </div>
        <ScrollingList paused={paused} label="Appointment schedule">
          {rows.length === 0 && (
            <div className="tv-column-empty tv-schedule-empty">
              <CalendarDays aria-hidden="true" />
              <p>
                No appointments
                <br />
                scheduled today.
              </p>
            </div>
          )}
          {rows.map((job) => {
            const accent = serviceAccentColor(job.requested_service);
            return (
              <div
                key={job.id}
                className="tv-appointment"
                data-in-shop={job.arrival_at !== null}
                style={accent ? ({ "--tv-service-accent": accent } as CSSProperties) : undefined}
              >
                <div className="tv-appointment-heading">
                  <p className="tv-appointment-time">{tvTime(job.appointment_at, timezone)}</p>
                  {job.arrival_at !== null && <TvInShopBadge />}
                </div>
                <h3>{job.customer_name ?? "Customer not recorded"}</h3>
                <p>{job.vehicle_label ?? "Vehicle not recorded"}</p>
                <p>{job.requested_service ?? "Service not recorded"}</p>
              </div>
            );
          })}
        </ScrollingList>
        <p className="tv-schedule-signature">
          Quality service today.
          <br />
          More miles tomorrow.
        </p>
      </section>
    </div>
  );
}
