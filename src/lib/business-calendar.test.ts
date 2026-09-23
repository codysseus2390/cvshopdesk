import { describe, expect, it } from "vitest";
import {
  earliestRetroactiveStatusChange,
  isOpenDay,
  missingOpenDates,
  openDates,
  previousOpenDay,
  proratedGoal,
  type BusinessCalendar,
} from "./business-calendar";
const calendar: BusinessCalendar = {
  schedules: [{ effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] }],
  exceptions: [],
};
describe("confirmed shop calendar", () => {
  it("uses Friday on Monday even if Friday has no report", () => {
    expect(previousOpenDay("2026-09-21", calendar)).toBe("2026-09-18");
  });
  it("does not let a real Saturday entry cover a missing Tuesday", () => {
    const expected = openDates("2026-09-14", "2026-09-20", calendar)!;
    expect(
      missingOpenDates(expected, [
        "2026-09-14",
        "2026-09-16",
        "2026-09-17",
        "2026-09-18",
        "2026-09-19",
      ]),
    ).toEqual(["2026-09-15"]);
  });
  it("uses explicit exceptions and effective dates without inventing holidays", () => {
    expect(isOpenDay("2026-12-25", calendar)).toBe(true);
    expect(
      previousOpenDay("2026-09-21", {
        ...calendar,
        exceptions: [{ business_date: "2026-09-18", is_open: false, reason: "Closed" }],
      }),
    ).toBe("2026-09-17");
    expect(isOpenDay("2019-12-31", calendar)).toBeNull();
  });
  it("allocates a split-month week using each month's denominator", () => {
    const expected = (1000 * 1) / 21 + (1000 * 4) / 22;
    expect(proratedGoal(1000, "2026-08-31", "2026-09-06", calendar)).toBeCloseTo(expected);
    expect(proratedGoal(1000, "2026-09-19", "2026-09-20", calendar)).toBeNull();
  });
});

describe("retroactive-edit guard math", () => {
  const today = "2026-09-21";

  it("never flags a first-time calendar (no established baseline)", () => {
    expect(earliestRetroactiveStatusChange(null, calendar, today)).toBeNull();
  });

  it("returns null when the change is forward-dated only", () => {
    const changed: BusinessCalendar = {
      schedules: [
        ...calendar.schedules,
        { effective_from: "2026-09-22", open_weekdays: [1, 3, 5] },
      ],
      exceptions: [],
    };
    expect(earliestRetroactiveStatusChange(calendar, changed, today)).toBeNull();
  });

  it("flags the earliest past date whose open/closed status actually changes", () => {
    // A schedule inserted mid-history (Iron review finding #1): only the newly
    // added effective_from date is "changed", so the scan starts there, not at
    // the original schedule's much older effective_from.
    const changed: BusinessCalendar = {
      schedules: [
        ...calendar.schedules,
        { effective_from: "2026-09-01", open_weekdays: [1, 2, 3, 4, 5, 6] },
      ],
      exceptions: [],
    };
    // 2026-09-01 (Tue) starts the new schedule; the first Saturday on/after it
    // (2026-09-05) flips from closed (old) to open (new).
    expect(earliestRetroactiveStatusChange(calendar, changed, today)).toBe("2026-09-05");
  });

  it("ignores a new exception that doesn't change status on/before today", () => {
    const changed: BusinessCalendar = {
      ...calendar,
      exceptions: [{ business_date: "2026-09-16", is_open: true, reason: "Already a weekday" }],
    };
    expect(earliestRetroactiveStatusChange(calendar, changed, today)).toBeNull();
  });

  it("flags an exception that reopens a past closed date", () => {
    const withClosure: BusinessCalendar = {
      ...calendar,
      exceptions: [{ business_date: "2026-09-17", is_open: false, reason: "Storm" }],
    };
    const reopened: BusinessCalendar = { ...calendar, exceptions: [] };
    expect(earliestRetroactiveStatusChange(withClosure, reopened, today)).toBe("2026-09-17");
  });
});
