import type { TvStatus } from "@/components/tv/tv-status";
import { isFinishedJob } from "./import-records";

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

export function buildTvBoard(
  board: {
    appointments: TvBoardJob[];
    jobs: TvBoardJob[];
    jobsWithoutArrival: TvBoardJob[];
    done: TvBoardJob[];
    timezone: string;
  },
  now: number,
) {
  const schedule = board.appointments.filter((job) =>
    withinNextTwelveHours(job.appointment_at, now),
  );
  const activeJobs = [...board.jobs, ...board.jobsWithoutArrival].filter(
    (job) => workflowStatus(job) !== "done",
  );
  const activeIds = new Set([...activeJobs, ...board.done].map((job) => job.id));
  const nextUp = [...activeJobs, ...schedule.filter((job) => !activeIds.has(job.id))];
  return {
    schedule,
    nextUp,
    counts: {
      inShop: activeJobs.filter((job) => workflowStatus(job) === "in_shop").length,
      upcoming: nextUp.filter((job) => workflowStatus(job) === "upcoming").length,
      done: board.done.length,
    },
    nextAppointment: schedule[0]?.appointment_at
      ? tvTime(schedule[0].appointment_at, board.timezone)
      : null,
  };
}
