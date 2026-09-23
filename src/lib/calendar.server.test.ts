import { describe, expect, it } from "vitest";
import {
  CalendarMigrationNotAppliedError,
  readBusinessCalendar,
  readBusinessCalendarLenient,
} from "./calendar.server";

const validCalendar = {
  schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
  exceptions: [],
};

function supabaseReturning(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  };
}

describe("readBusinessCalendar a/b/c contract", () => {
  it("(a) throws a distinct, migration-naming error on 42703 (undefined column)", async () => {
    const supabase = supabaseReturning({
      data: null,
      error: { code: "42703", message: "column shop_settings.business_calendar does not exist" },
    });
    await expect(readBusinessCalendar(supabase, "shop-a")).rejects.toThrow(
      CalendarMigrationNotAppliedError,
    );
    await expect(readBusinessCalendar(supabase, "shop-a")).rejects.toThrow(
      /0024_business_calendar has not been applied/,
    );
  });

  it("(a) also treats PGRST204/schema-cache column-missing variants as unapplied migration", async () => {
    const supabase = supabaseReturning({
      data: null,
      error: { code: "PGRST204", message: "Column 'business_calendar' not found in schema cache" },
    });
    await expect(readBusinessCalendar(supabase, "shop-a")).rejects.toThrow(
      CalendarMigrationNotAppliedError,
    );
  });

  it("(a) does not misclassify an unrelated error as a missing migration", async () => {
    const supabase = supabaseReturning({
      data: null,
      error: { code: "500", message: "network failure" },
    });
    await expect(readBusinessCalendar(supabase, "shop-a")).rejects.toThrow(
      "Unable to load the shop calendar.",
    );
  });

  it("(b) returns null when the calendar is not configured yet — no fallback, no throw", async () => {
    const supabase = supabaseReturning({ data: { business_calendar: null }, error: null });
    await expect(readBusinessCalendar(supabase, "shop-a")).resolves.toBeNull();
  });

  it("(b) returns null when the shop_settings row doesn't exist at all", async () => {
    const supabase = supabaseReturning({ data: null, error: null });
    await expect(readBusinessCalendar(supabase, "shop-a")).resolves.toBeNull();
  });

  it("(c) returns the parsed calendar when configured and valid", async () => {
    const supabase = supabaseReturning({
      data: { business_calendar: validCalendar },
      error: null,
    });
    await expect(readBusinessCalendar(supabase, "shop-a")).resolves.toEqual(validCalendar);
  });

  it("(c) keeps the existing owner-configuration throw for a malformed non-null calendar", async () => {
    const supabase = supabaseReturning({
      data: { business_calendar: { schedules: "not-an-array" } },
      error: null,
    });
    await expect(readBusinessCalendar(supabase, "shop-a")).rejects.toThrow(
      "The owner needs to configure the shop's business calendar in Settings.",
    );
  });
});

describe("readBusinessCalendarLenient (retroactive-guard baseline read)", () => {
  it("still throws the distinct migration error", async () => {
    const supabase = supabaseReturning({
      data: null,
      error: { code: "42703", message: "column business_calendar does not exist" },
    });
    await expect(readBusinessCalendarLenient(supabase, "shop-a")).rejects.toThrow(
      CalendarMigrationNotAppliedError,
    );
  });

  it("treats a malformed stored value as no baseline instead of throwing", async () => {
    const supabase = supabaseReturning({
      data: { business_calendar: { garbage: true } },
      error: null,
    });
    await expect(readBusinessCalendarLenient(supabase, "shop-a")).resolves.toBeNull();
  });

  it("returns the parsed calendar when valid", async () => {
    const supabase = supabaseReturning({
      data: { business_calendar: validCalendar },
      error: null,
    });
    await expect(readBusinessCalendarLenient(supabase, "shop-a")).resolves.toEqual(validCalendar);
  });
});
