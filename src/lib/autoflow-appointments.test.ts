import { describe, expect, it, vi } from "vitest";
import { appointmentInstant, parseAutoflowAppointments } from "./autoflow-appointments";
import { loadAutoflowAppointments } from "./autoflow-appointments.server";

describe("Autoflow appointments", () => {
  it("interprets summer/winter local times in the shop zone and respects explicit offsets", () => {
    expect(appointmentInstant("2026-09-23T09:00:00", "America/Chicago")).toBe(
      "2026-09-23T14:00:00.000Z",
    );
    expect(appointmentInstant("2026-01-23T09:00:00", "America/Chicago")).toBe(
      "2026-01-23T15:00:00.000Z",
    );
    expect(appointmentInstant("2026-09-23T09:00:00-05:00", "America/Chicago")).toBe(
      "2026-09-23T14:00:00.000Z",
    );
    expect(appointmentInstant("2026-03-08T02:30:00", "America/Chicago")).toBeNull();
    expect(appointmentInstant("2026-02-30T09:00:00", "America/Chicago")).toBeNull();
    expect(appointmentInstant(null, "America/Chicago")).toBeNull();
  });
  it("keeps stable identities and missing values without forwarding private fields", () => {
    const rows = parseAutoflowAppointments(
      {
        response_code: 200,
        appointments: [
          {
            id: 12,
            customer: { first_name: "Test", last_name: "Customer", phone_numbers: ["private"] },
            vehicle: { vin: "private" },
            questionnaire: ["private"],
          },
          {
            id: 13,
            date_time: "2026-09-23T09:00:00",
            reason_for_visit: [{ title: "Oil change", tech_notes: "private" }],
          },
          { id: 13, date_time: "2026-09-23T10:00:00" },
        ],
      },
      "America/Chicago",
      "2026-09-23T00:00:00Z",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "autoflow:12",
      customer_name: "Test Customer",
      appointment_at: null,
      arrival_at: null,
      vehicle_label: null,
    });
    expect(JSON.stringify(rows)).not.toContain("private");
    expect(rows[1]?.appointment_at).toBe("2026-09-23T15:00:00.000Z");
  });
  it("rejects bad envelopes instead of reporting an empty schedule", () => {
    expect(() =>
      parseAutoflowAppointments({ response_code: 401, appointments: [] }, "UTC", "now"),
    ).toThrow();
    expect(() => parseAutoflowAppointments({ response_code: 200 }, "UTC", "now")).toThrow();
  });
  it("never calls the shop credential for a different shop or disabled integration", async () => {
    const read = vi.fn();
    await expect(
      loadAutoflowAppointments(
        "other",
        "UTC",
        "2026-09-23",
        { AUTOFLOW_APPOINTMENTS_ENABLED: "true", AUTOFLOW_SHOPDESK_SHOP_ID: "allowed" },
        read,
      ),
    ).resolves.toBeNull();
    await expect(
      loadAutoflowAppointments("allowed", "UTC", "2026-09-23", {}, read),
    ).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it("reads a bounded date range and surfaces provider failure", async () => {
    const env = { AUTOFLOW_APPOINTMENTS_ENABLED: "true", AUTOFLOW_SHOPDESK_SHOP_ID: "allowed" };
    const read = vi.fn().mockResolvedValue({ response_code: 200, appointments: [] });
    await expect(
      loadAutoflowAppointments("allowed", "UTC", "2026-09-23", env, read),
    ).resolves.toEqual([]);
    expect(read).toHaveBeenCalledWith(
      { resource: "appointments", start: "2026-09-23T00:00:00", end: "2026-10-23T23:59:59" },
      env,
    );
    read.mockRejectedValueOnce(new Error("Unavailable"));
    await expect(
      loadAutoflowAppointments("allowed", "UTC", "2026-09-23", env, read),
    ).rejects.toThrow();
  });
});
