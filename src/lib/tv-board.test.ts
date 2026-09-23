import { describe, expect, it } from "vitest";
import {
  buildTvBoard,
  checkinElapsed,
  tvTime,
  withinNextTwelveHours,
  workflowStatus,
  type TvBoardJob,
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
