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

describe("leap day / February 29", () => {
  it("treats Feb 29 in a leap year as a normal confirmed weekday", () => {
    // 2028-02-29 is a Tuesday.
    expect(isOpenDay("2028-02-29", calendar)).toBe(true);
  });

  it("prorates a range ending on Feb 29 using the leap year's real days-in-month", () => {
    // Feb 2028 has 21 confirmed open (Mon-Fri) days; Feb 24 (Thu) - Feb 29 (Tue)
    // contains 4 of them (24, 25, 28, 29 - the 26/27 weekend is excluded).
    expect(proratedGoal(2100, "2028-02-24", "2028-02-29", calendar)).toBe(400);
  });
});

describe("a week crossing both a month and a year boundary", () => {
  it("allocates Dec 28 - Jan 3 across December's and January's own denominators", () => {
    // Dec 2026: 23 confirmed open days total, 4 of them (28-31) fall in range.
    // Jan 2027: 21 confirmed open days total, 1 of them (Jan 1, a Friday) falls in range.
    const expected = (1000 * 4) / 23 + (1000 * 1) / 21;
    expect(proratedGoal(1000, "2026-12-28", "2027-01-03", calendar)).toBeCloseTo(expected);
  });
});

describe("multiple schedules / effective-date boundary", () => {
  const multiSchedule: BusinessCalendar = {
    schedules: [
      { effective_from: "2020-01-01", open_weekdays: [1, 2, 3, 4, 5] },
      { effective_from: "2026-07-01", open_weekdays: [1, 2, 3, 4, 5, 6] },
    ],
    exceptions: [],
  };

  it("keeps resolving a date before the later schedule's effective date against the older schedule", () => {
    // 2026-06-27 is a Saturday, still closed under the original Mon-Fri schedule.
    expect(isOpenDay("2026-06-27", multiSchedule)).toBe(false);
  });

  it("applies the newer schedule once its effective date arrives", () => {
    // 2026-07-04 is a Saturday, open under the new Mon-Sat schedule (effective 2026-07-01).
    expect(isOpenDay("2026-07-04", multiSchedule)).toBe(true);
  });

  it("does not let a later schedule change retroactively reinterpret an earlier, fully-past period", () => {
    // The whole June 2026 range is before the new schedule's effective date, so
    // proratedGoal's own month denominator (22 Mon-Fri open days) must also resolve
    // against the original schedule, not the one added afterward.
    expect(proratedGoal(500, "2026-06-22", "2026-06-28", multiSchedule)).toBeCloseTo(
      (500 * 5) / 22,
    );
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

  it("flags an exception dated exactly today - the <= today boundary is inclusive", () => {
    const changed: BusinessCalendar = {
      ...calendar,
      exceptions: [{ business_date: today, is_open: false, reason: "Closed today" }],
    };
    expect(earliestRetroactiveStatusChange(calendar, changed, today)).toBe(today);
  });
});
