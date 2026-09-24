import { describe, expect, it } from "vitest";
import { projectAutoflowWorkflow } from "./autoflow-workflow";
const event = (status: string, timestamp: string, id = "42") => ({
  received_at: timestamp,
  payload: {
    event: { id: `test-${timestamp}`, type: "status_update", timestamp },
    shop: { id: "2966", domain: "cedarvalley.autotext.me" },
    ticket: { id, status },
    customer: { firstname: "Test", lastname: "Customer", phone: "private" },
    vehicle: { year: 2020, make: "Test", model: "Car", vin: "private" },
  },
});
const project = (events: ReturnType<typeof event>[]) =>
  projectAutoflowWorkflow(events, [], "2966", "cedarvalley", "America/Chicago");
describe("Autoflow workflow projection", () => {
  it("includes unscheduled work, orders delayed events by provider time, and keeps the first check-in", () => {
    const rows = project([
      event("Ready", "2026-09-23T16:00:00Z"),
      event("Checkin", "2026-09-23T13:00:00Z"),
      event("Inspecting", "2026-09-23T14:00:00Z"),
      event("Checkin", "2026-09-23T15:00:00Z"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "autoflow:42",
      record_kind: "job",
      appointment_at: null,
      arrival_at: "2026-09-23T13:00:00.000Z",
      job_status: "Ready",
      completed_at: "2026-09-23T16:00:00.000Z",
    });
    expect(JSON.stringify(rows)).not.toContain("private");
  });
  it("never uses inspection time as check-in and keeps same-name visits separate", () => {
    const rows = project([
      event("Inspecting", "2026-09-23T14:00:00Z"),
      event("Inspecting", "2026-09-23T14:00:00Z", "43"),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.arrival_at === null)).toBe(true);
  });
  it("preserves a verified baseline and local notes while applying newer events", () => {
    const seeds = project([event("Checkin", "2026-09-23T13:00:00Z")]).map((r) => ({
      ...r,
      local_note: "Keep this",
      requested_service: "Oil change",
      snapshot_at: "2026-09-23T15:00:00.000Z",
    }));
    const rows = projectAutoflowWorkflow(
      [event("Inspecting", "2026-09-23T14:00:00Z"), event("Servicing", "2026-09-23T16:00:00Z")],
      seeds,
      "2966",
      "cedarvalley",
      "America/Chicago",
    );
    expect(rows[0]).toMatchObject({
      job_status: "Servicing",
      local_note: "Keep this",
      requested_service: "Oil change",
      arrival_at: "2026-09-23T13:00:00.000Z",
    });
    expect(seeds[0]?.job_status).toBe("Checkin");
  });
  it("rejects malformed, wrong-shop, and future-dated events instead of silent empty results", () => {
    expect(() =>
      projectAutoflowWorkflow(
        [{ payload: {}, received_at: "now" }],
        [],
        "2966",
        "cedarvalley",
        "UTC",
      ),
    ).toThrow();
    expect(() =>
      projectAutoflowWorkflow(
        [event("Ready", "2026-09-23T14:00:00Z")],
        [],
        "other",
        "cedarvalley",
        "UTC",
      ),
    ).toThrow();
    expect(() =>
      project([{ ...event("Ready", "2026-09-24T14:00:00Z"), received_at: "2026-09-23T14:00:00Z" }]),
    ).toThrow();
  });
});
