import type { TvStatus } from "@/components/tv/tv-status";
import { isFinishedJob } from "./import-records";
import { shopToday } from "./metrics-math";

export interface TvBoardJob {
  id: string;
  customer_name: string | null;
  vehicle_label: string | null;
  requested_service: string | null;
  appointment_at: string | null;
  arrival_at: string | null;
  job_status: string | null;
  local_status: string | null;
}

export function workflowStatus(job: Pick<TvBoardJob, "job_status" | "local_status">): TvStatus {
  const status = (job.job_status ?? "")
    .toLowerCase()
    .replace(/[()_-]/g, " ")
    .trim();
  if (
    /^(ready|close|closed|picked up)$/.test(status) ||
    isFinishedJob({ job_status: job.job_status })
  )
    return "done";
  if (/inspect|estimating|waiting approval|waiting parts|servicing/.test(status)) return "in_shop";
  if (!status && isFinishedJob(job)) return "done";
  return "upcoming";
}

export function withinNextTwelveHours(iso: string | null, now: number): boolean {
  if (!iso) return false;
  const time = Date.parse(iso);
  return time >= now && time <= now + 12 * 60 * 60 * 1000;
}

export function tvTime(iso: string | null, timezone: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "Time unavailable";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function checkinElapsed(iso: string | null, now: number): string {
  if (!iso) return "Not checked in";
  const seconds = Math.floor((now - Date.parse(iso)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return "Check-in time unavailable";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Enough of a workflow row to merge into a schedule row's live check-in/status. */
export interface TvWorkflowLike {
  id: string;
  customer_name: string | null;
  vehicle_label: string | null;
  requested_service: string | null;
  arrival_at: string | null;
  job_status: string | null;
  local_status: string | null;
}

/**
 * Today's Schedule, correctly: every one of today's appointments (the shop's whole
 * calendar day, not a rolling window) merged with its live workflow row via the real
 * Autoflow ticket id, so a checked-in or in-shop customer keeps their appointment's
 * service info while picking up real status. A row drops off only once the work order
 * is genuinely closed — `isFinishedJob` does not treat "Ready for pickup" as closed.
 */
export function buildTodaySchedule(
  appointments: TvBoardJob[],
  workflowRows: TvWorkflowLike[],
  timezone: string,
  today: string,
): TvBoardJob[] {
  const workflowById = new Map(workflowRows.map((row) => [row.id, row]));
  return appointments
    .filter(
      (row) =>
        Boolean(row.appointment_at) &&
        shopToday(timezone, new Date(row.appointment_at as string)) === today,
    )
    .map((row): TvBoardJob => {
      const linked = workflowById.get(row.id);
      return {
        id: row.id,
        customer_name: row.customer_name ?? linked?.customer_name ?? null,
        vehicle_label: row.vehicle_label ?? linked?.vehicle_label ?? null,
        requested_service: row.requested_service ?? linked?.requested_service ?? null,
        appointment_at: row.appointment_at,
        arrival_at: linked?.arrival_at ?? null,
        job_status: linked?.job_status ?? null,
        local_status: linked?.local_status ?? null,
      };
    })
    .filter((row) => !isFinishedJob(row))
    .sort((a, b) => (a.appointment_at ?? "").localeCompare(b.appointment_at ?? ""));
}

export function buildTvBoard(
  board: {
    appointments: TvBoardJob[];
    jobs: TvBoardJob[];
    jobsWithoutArrival: TvBoardJob[];
    done: TvBoardJob[];
    /** Today's full shop-day schedule, already merged with live workflow state and
     * limited to work that isn't genuinely closed yet. See records.functions.ts. */
    scheduleToday?: TvBoardJob[];
    timezone: string;
  },
  now: number,
) {
  // Unchanged rolling window, still used by the dashboard's "next 12 hours" panel.
  const schedule = board.appointments.filter((job) =>
    withinNextTwelveHours(job.appointment_at, now),
  );
  const activeJobs = [...board.jobs, ...board.jobsWithoutArrival].filter(
    (job) => workflowStatus(job) !== "done",
  );
  const activeIds = new Set([...activeJobs, ...board.done].map((job) => job.id));
  const nextUp = [...activeJobs, ...schedule.filter((job) => !activeIds.has(job.id))];

  // TV Mode's Today's Schedule: the whole shop day, staying visible through
  // check-in and servicing, dropping off only once the work order is genuinely closed.
  const todaySchedule = board.scheduleToday ?? [];
  const nextAppointment =
    todaySchedule
      .filter(
        (job) =>
          job.arrival_at === null && job.appointment_at && Date.parse(job.appointment_at) >= now,
      )
      .sort((a, b) => (a.appointment_at ?? "").localeCompare(b.appointment_at ?? ""))[0] ?? null;

  return {
    schedule,
    todaySchedule,
    nextUp,
    counts: {
      inShop: activeJobs.filter((job) => workflowStatus(job) === "in_shop").length,
      upcoming: nextUp.filter((job) => workflowStatus(job) === "upcoming").length,
      done: board.done.length,
    },
    nextAppointment,
  };
}
