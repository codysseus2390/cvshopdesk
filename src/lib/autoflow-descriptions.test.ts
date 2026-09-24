import { describe, expect, it, vi } from "vitest";
import { createDescriptionLoader, parseVisitDescription } from "./autoflow-descriptions.server";
import { parseAutoflowAppointments } from "./autoflow-appointments";
import { projectAutoflowWorkflow, type WorkflowRow } from "./autoflow-workflow";

const payload = (details: Array<string | null>) => ({
  success: 1,
  content: {
    invoice: 123,
    remote_ticket_id: "ticket-1",
    customer_email: "private@example.test",
    reason_vehicle_is_here: details.map((details) => ({ details, notes: "private note" })),
  },
});
const row = (): WorkflowRow => ({
  ...parseAutoflowAppointments(
    { response_code: 200, appointments: [{ id: "1" }] },
    "UTC",
    "2026-09-23T20:00:00Z",
  )[0]!,
  record_kind: "job",
  job_status: "Inspecting",
  completed_at: null,
  repair_order_number: "123",
  remote_ticket_id: "ticket-1",
  requested_service: "Known description",
});

describe("Autoflow job descriptions", () => {
  it("reads actual visit reasons, decodes entities, deduplicates, and excludes private data", () => {
    expect(
      parseVisitDescription(
        payload(["Oil &amp; filter", "Oil &amp; filter", null, "  Check &#x41;/C  "]),
        "123",
        "ticket-1",
      ),
    ).toBe("Oil & filter · Check A/C");
    expect(parseVisitDescription(payload([null, " "]), "123")).toBeNull();
  });
  it("rejects another repair order or visit instead of displaying its description", () => {
    expect(() => parseVisitDescription(payload(["Oil change"]), "456")).toThrow();
    expect(() => parseVisitDescription(payload(["Oil change"]), "123", "other-ticket")).toThrow();
    expect(() => parseVisitDescription({ success: 0 }, "123")).toThrow();
  });
  it("enriches workflow rows and refreshes edited descriptions after the cache expires", async () => {
    let now = 0;
    const read = vi.fn(async () => payload(["Oil change"]));
    const load = createDescriptionLoader(read, () => now);
    const source = row();
    expect((await load([source, source], "shop", {})).map((r) => r.requested_service)).toEqual([
      "Oil change",
      "Oil change",
    ]);
    expect(source.requested_service).toBe("Known description");
    expect(read).toHaveBeenCalledTimes(1);
    await load([source], "shop", {});
    expect(read).toHaveBeenCalledTimes(1);
    now = 61_000;
    read.mockResolvedValue(payload(["Brake inspection"]));
    expect((await load([source], "shop", {}))[0]?.requested_service).toBe("Brake inspection");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("preserves known descriptions on API failure, and does not request RO zero or finished visits", async () => {
    const read = vi.fn(async () => {
      throw new Error("offline");
    });
    const load = createDescriptionLoader(read);
    const result = await load(
      [row(), { ...row(), repair_order_number: "0" }, { ...row(), job_status: "Ready" }],
      "shop",
      {},
    );
    expect(result.every((r) => r.requested_service === "Known description")).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("retains RO mappings from baselines and status events older than a baseline", () => {
    const seeded = {
      ...row(),
      repair_order_number: null,
      remote_ticket_id: null,
      flags: ["autoflow_ro:123"],
    };
    const events = [
      {
        received_at: "2026-09-23T19:00:00Z",
        payload: {
          event: { id: "event", type: "status_update", timestamp: "2026-09-23T19:00:00Z" },
          shop: { id: "shop", domain: "test.autotext.me" },
          ticket: { id: "1", invoice: 123, remote_id: "ticket-1", status: "Checkin" },
        },
      },
    ];
    expect(projectAutoflowWorkflow(events, [seeded], "shop", "test", "UTC")[0]).toMatchObject({
      repair_order_number: "123",
      remote_ticket_id: "ticket-1",
      job_status: "Inspecting",
    });
    expect(projectAutoflowWorkflow(events, [], "shop", "test", "UTC")[0]).toMatchObject({
      repair_order_number: "123",
      remote_ticket_id: "ticket-1",
    });
  });
});
