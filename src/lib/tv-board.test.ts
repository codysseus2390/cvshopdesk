import { describe, expect, it } from "vitest";
import {
  buildTodaySchedule,
  buildTvBoard,
  checkinElapsed,
  tvTime,
  withinNextTwelveHours,
  workflowStatus,
  type TvBoardJob,
  type TvWorkflowLike,
} from "./tv-board";
const now = Date.parse("2026-09-23T21:00:00Z");
const row = (id: string, extras: Partial<TvBoardJob> = {}): TvBoardJob => ({
  id,
  customer_name: null,
  vehicle_label: null,
  requested_service: null,
  appointment_at: null,
  arrival_at: null,
  job_status: null,
  local_status: null,
  ...extras,
});
describe("TV workflow", () => {
  it("maps checked in, every service stage, and ready", () => {
    expect(workflowStatus(row("a", { job_status: "Checkin" }))).toBe("upcoming");
    for (const status of [
      "Inspecting",
      "(Estimating)",
      "Waiting Approval",
      "(Waiting parts)",
      "Servicing",
    ])
      expect(workflowStatus(row("a", { job_status: status }))).toBe("in_shop");
    for (const status of ["Ready", "Close", "Closed"])
      expect(workflowStatus(row("a", { job_status: status }))).toBe("done");
  });
  it("uses a rolling 12-hour window across midnight with exact boundaries", () => {
    expect(withinNextTwelveHours("2026-09-24T09:00:00Z", now)).toBe(true);
    expect(withinNextTwelveHours("2026-09-24T09:00:01Z", now)).toBe(false);
    expect(withinNextTwelveHours("2026-09-23T20:59:59Z", now)).toBe(false);
    expect(withinNextTwelveHours(null, now)).toBe(false);
  });
  it("retains old unfinished visits, removes completed ones, and deduplicates by visit ID", () => {
    const result = buildTvBoard(
      {
        appointments: [
          row("active", { appointment_at: "2026-09-23T22:00:00Z" }),
          row("future", { appointment_at: "2026-09-23T23:00:00Z" }),
          row("tomorrow", { appointment_at: "2026-09-24T13:00:00Z" }),
        ],
        jobs: [row("active", { arrival_at: "2026-09-20T13:00:00Z", job_status: "Inspecting" })],
        jobsWithoutArrival: [row("walkin", { job_status: "Checkin" })],
        done: [row("done", { job_status: "Ready" })],
        timezone: "America/Chicago",
      },
      now,
    );
    expect(result.nextUp.map((r) => r.id)).toEqual(["active", "walkin", "future"]);
    expect(result.counts).toEqual({ inShop: 1, upcoming: 2, done: 1 });
  });
  it("shows explicit shop AM/PM and never fabricates a check-in", () => {
    expect(tvTime("2026-09-24T13:00:00Z", "America/Chicago")).toBe("8:00 AM");
    expect(checkinElapsed(null, now)).toBe("Not checked in");
    expect(checkinElapsed("bad", now)).toBe("Check-in time unavailable");
    expect(checkinElapsed("2026-09-23T19:58:57Z", now)).toBe("1:01:03");
  });
});

describe("Today's Schedule", () => {
  const workflow = (id: string, extras: Partial<TvWorkflowLike> = {}): TvWorkflowLike => ({
    id,
    customer_name: null,
    vehicle_label: null,
    requested_service: null,
    arrival_at: null,
    job_status: null,
    local_status: null,
    ...extras,
  });

  it("keeps an appointment for the whole shop day, even after its time passes", () => {
    // Shop day 2026-09-23 in America/Chicago runs 2026-09-23T05:00Z .. 2026-09-24T05:00Z.
    const result = buildTodaySchedule(
      [
        row("morning", { appointment_at: "2026-09-23T14:00:00Z" }), // 9am shop time, already past
        row("evening", { appointment_at: "2026-09-24T00:00:00Z" }), // 7pm shop time, still today
        row("tomorrow", { appointment_at: "2026-09-24T14:00:00Z" }), // 9am shop time, next shop day
      ],
      [],
      "America/Chicago",
      "2026-09-23",
    );
    expect(result.map((r) => r.id)).toEqual(["morning", "evening"]);
  });

  it("merges by the real Autoflow ticket id, preferring the appointment's own service text", () => {
    const result = buildTodaySchedule(
      [
        row("autoflow:1", {
          customer_name: "Jane Doe",
          vehicle_label: "2020 Ford Explorer",
          requested_service: "Brake service",
          appointment_at: "2026-09-23T14:00:00Z",
        }),
      ],
      [
        workflow("autoflow:1", {
          arrival_at: "2026-09-23T14:05:00Z",
          job_status: "Servicing",
          requested_service: null,
        }),
      ],
      "America/Chicago",
      "2026-09-23",
    );
    expect(result).toEqual([
      {
        id: "autoflow:1",
        customer_name: "Jane Doe",
        vehicle_label: "2020 Ford Explorer",
        requested_service: "Brake service",
        appointment_at: "2026-09-23T14:00:00Z",
        arrival_at: "2026-09-23T14:05:00Z",
        job_status: "Servicing",
        local_status: null,
      },
    ]);
  });

  it("keeps 'Ready for pickup' visible — it is not genuinely closed — and drops truly closed visits", () => {
    const result = buildTodaySchedule(
      [
        row("ready", { appointment_at: "2026-09-23T14:00:00Z" }),
        row("closed", { appointment_at: "2026-09-23T14:00:00Z" }),
        row("open", { appointment_at: "2026-09-23T14:00:00Z" }),
      ],
      [
        workflow("ready", { arrival_at: "2026-09-23T14:05:00Z", job_status: "Ready" }),
        workflow("closed", { arrival_at: "2026-09-23T14:05:00Z", job_status: "Picked Up" }),
        workflow("open", { arrival_at: "2026-09-23T14:05:00Z", job_status: "Servicing" }),
      ],
      "America/Chicago",
      "2026-09-23",
    );
    expect(result.map((r) => r.id).sort()).toEqual(["open", "ready"]);
  });
});
