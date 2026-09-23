import { afterEach, describe, expect, it, vi } from "vitest";
import { openDates, type BusinessCalendar } from "@/lib/business-calendar";
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

function makeSupabase(productivityRows: unknown[], metricSnapshotRows: unknown[] = []) {
  return {
    from: (table: string) => {
      if (table === "metric_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: async () => ({ data: metricSnapshotRows, error: null }),
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

function context(supabase: unknown, role = "staff"): ShopAiToolContext {
  return {
    supabase,
    shopId: "shop-a",
    userId: "user-a",
    role,
    timezone: "America/Chicago",
    today: MONDAY,
    can: () => true,
    sourceType: "text",
  };
}

/** Chainable Supabase query-builder stub: every chain method returns itself and
 * the object is thenable, resolving to the fixed `{ data, error }` result — the
 * exact shape `readAllRows` and the real (unmocked) `buildNumbersReport` expect. */
interface Chainable {
  select: () => Chainable;
  eq: () => Chainable;
  or: () => Chainable;
  order: () => Chainable;
  gte: () => Chainable;
  lte: () => Chainable;
  limit: () => Chainable;
  range: () => Chainable;
  maybeSingle: () => Chainable;
  then: (resolve: (value: { data: unknown; error: { message: string } | null }) => void) => void;
}

function chainable(data: unknown, error: { message: string } | null = null): Chainable {
  const builder: Chainable = {
    select: () => builder,
    eq: () => builder,
    or: () => builder,
    order: () => builder,
    gte: () => builder,
    lte: () => builder,
    limit: () => builder,
    range: () => builder,
    maybeSingle: () => builder,
    then: (resolve) => resolve({ data, error }),
  };
  return builder;
}

/** A full Supabase stub covering every table the real (unmocked) buildNumbersReport
 * reads — used only by the tests that exercise its actual permission check. */
function makeFullSupabase(
  tables: Record<string, { data: unknown; error?: { message: string } | null }>,
) {
  return {
    from: (table: string) => {
      const entry = tables[table];
      if (!entry) throw new Error(`Unexpected table query: ${table}`);
      return chainable(entry.data, entry.error ?? null);
    },
  };
}

const REAL_NUMBERS_SERVER_TABLES = {
  role_permissions: { data: [] as unknown[] },
  shop_settings: { data: null as unknown },
  metric_snapshots: { data: [] as unknown[] },
  technician_productivity: { data: [] as unknown[] },
  metric_corrections: { data: [] as unknown[] },
};

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

describe("Hank's get_dashboard_numbers monthToDate is calendar-aware", () => {
  it("counts a missing open weekday but not a closed weekend day as missing, using the calendar", async () => {
    const monthPrefix = "2026-09";
    // Same boundary monthToDate itself computes for the current month: today minus one day.
    const upperBound = SUNDAY; // 2026-09-20, the day before MONDAY (today)
    const expectedOpenDays = openDates(`${monthPrefix}-01`, upperBound, monFriCalendar);
    if (!expectedOpenDays || expectedOpenDays.length < 2) {
      throw new Error("Test fixture error: expected at least two open weekdays in the range.");
    }
    // Leave the last open weekday (2026-09-18, a Friday) without a saved record.
    const missingDay = expectedOpenDays[expectedOpenDays.length - 1]!;
    const providedDays = expectedOpenDays.filter((date) => date !== missingDay);
    const metricRows = providedDays.map((date) => ({
      id: date,
      business_date: date,
      scope: "daily",
      gross_profit: 100,
      tires_sold: 1,
      car_count: 1,
      source: "manual",
      note: null,
      created_at: `${date}T12:00:00Z`,
    }));

    readBusinessCalendarMock.mockResolvedValueOnce(monFriCalendar);
    const supabase = makeSupabase([], metricRows);
    const result = (await tool.execute(context(supabase), {})) as {
      data: { monthToDate: { missing_days: number; covered_days: number } };
    };
    // Only the one omitted weekday is missing — the closed Sat/Sun days in between
    // are never counted, because the calendar was actually threaded through.
    expect(result.data.monthToDate.missing_days).toBe(1);
    expect(result.data.monthToDate.covered_days).toBe(providedDays.length);
  });
});

describe("Hank's report tools use the signed-in member's real role", () => {
  const numbersReportTool = SHOP_DATA_TOOLS.find((t) => t.name === "get_numbers_report")!;

  afterEach(() => {
    // Restore the module-level buildNumbersReport stub for every other describe block.
    vi.doMock("@/lib/numbers.server", () => ({
      buildNumbersReport: async () => ({ rows: [] }),
    }));
    vi.resetModules();
  });

  it("get_numbers_report returns data for a role that holds view_dashboard (real buildNumbersReport, not mocked)", async () => {
    vi.doUnmock("@/lib/numbers.server");
    vi.resetModules();
    readBusinessCalendarMock.mockResolvedValue(null);
    const supabase = makeFullSupabase(REAL_NUMBERS_SERVER_TABLES);
    const result = (await numbersReportTool.execute(context(supabase, "staff"), {
      period: "monthly",
    })) as { data: { rows: unknown[]; calendarConfigured: boolean } };
    expect(Array.isArray(result.data.rows)).toBe(true);
    expect(result.data.calendarConfigured).toBe(false);
  });

  it("get_numbers_report is denied for a role with view_dashboard explicitly revoked (real buildNumbersReport, not mocked)", async () => {
    vi.doUnmock("@/lib/numbers.server");
    vi.resetModules();
    readBusinessCalendarMock.mockResolvedValue(null);
    const supabase = makeFullSupabase({
      ...REAL_NUMBERS_SERVER_TABLES,
      role_permissions: {
        data: [{ role: "staff", permission: "view_dashboard", allowed: false }],
      },
    });
    await expect(
      numbersReportTool.execute(context(supabase, "staff"), { period: "monthly" }),
    ).rejects.toThrow("You do not have permission to view reports.");
  });
});
