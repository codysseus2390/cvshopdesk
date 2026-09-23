import { describe, expect, it, vi } from "vitest";
import type { BusinessCalendar } from "@/lib/business-calendar";
import { SHOP_PRODUCTIVITY_TECHNICIAN } from "@/lib/productivity-math";

const { readBusinessCalendarMock } = vi.hoisted(() => ({ readBusinessCalendarMock: vi.fn() }));

vi.mock("@/lib/calendar.server", () => ({
  readBusinessCalendar: readBusinessCalendarMock,
}));

// buildNumbersReport pulls in a large chunk of the reporting stack (its own
// supabase reads, goal rules, etc.) that is out of scope for this tool's own
// previousOpenDay wiring - stub it the way permission-loading.test.ts stubs
// resolveShop, so only get_dashboard_numbers' own logic is under test.
vi.mock("@/lib/numbers.server", () => ({
  buildNumbersReport: async () => ({ rows: [] }),
}));

import { SHOP_DATA_TOOLS } from "./shop-data.server";
import type { ShopAiToolContext } from "@/lib/ai/tools.server";

const monFriCalendar: BusinessCalendar = {
  schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
  exceptions: [],
};

// A Monday. Friday 2026-09-18 is its confirmed previous open day.
const MONDAY = "2026-09-21";
const FRIDAY = "2026-09-18";
const SUNDAY = "2026-09-20"; // plain previous calendar day (legacy, no-calendar path)

function overrideRow(businessDate: string, pct: number) {
  return {
    business_date: businessDate,
    technician: SHOP_PRODUCTIVITY_TECHNICIAN,
    productivity_pct: pct,
    hours_billed: null,
    hours_worked: null,
    period_scope: null,
    updated_at: `${businessDate}T10:00:00Z`,
  };
}

function makeSupabase(productivityRows: unknown[]) {
  return {
    from: (table: string) => {
      if (table === "metric_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "technician_productivity") {
        return {
          select: () => ({
            gte: () => ({
              lte: async () => ({ data: productivityRows, error: null }),
            }),
          }),
        };
      }
      throw new Error(`get_dashboard_numbers queried an unexpected table: ${table}`);
    },
  };
}

function context(supabase: unknown): ShopAiToolContext {
  return {
    supabase,
    shopId: "shop-a",
    userId: "user-a",
    timezone: "America/Chicago",
    today: MONDAY,
    can: () => true,
    sourceType: "text",
  };
}

const tool = SHOP_DATA_TOOLS.find((t) => t.name === "get_dashboard_numbers")!;

describe("Hank's get_dashboard_numbers previousOpenDay wiring", () => {
  it("agrees with the dashboard: on a Monday with a Mon-Fri calendar, 'yesterday' is Friday, not Sunday", async () => {
    readBusinessCalendarMock.mockResolvedValueOnce(monFriCalendar);
    const supabase = makeSupabase([overrideRow(FRIDAY, 77), overrideRow(SUNDAY, 55)]);
    const result = (await tool.execute(context(supabase), {})) as {
      data: { mechanicProductivity: { yesterday: number | null } };
    };
    expect(result.data.mechanicProductivity.yesterday).toBe(77);
  });

  it("falls back to the plain previous calendar day (legacy path) when no calendar is configured", async () => {
    readBusinessCalendarMock.mockResolvedValueOnce(null);
    const supabase = makeSupabase([overrideRow(FRIDAY, 77), overrideRow(SUNDAY, 55)]);
    const result = (await tool.execute(context(supabase), {})) as {
      data: { mechanicProductivity: { yesterday: number | null } };
    };
    expect(result.data.mechanicProductivity.yesterday).toBe(55);
  });

  it("throws instead of guessing when the calendar is configured but has no previous open day", async () => {
    const unresolvable: BusinessCalendar = {
      schedules: [{ effective_from: "2030-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
      exceptions: [],
    };
    readBusinessCalendarMock.mockResolvedValueOnce(unresolvable);
    const supabase = makeSupabase([]);
    await expect(tool.execute(context(supabase), {})).rejects.toThrow(
      "The shop calendar does not identify a previous open day.",
    );
  });
});
