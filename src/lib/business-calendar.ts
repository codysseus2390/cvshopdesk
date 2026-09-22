import { addDays, daysInMonth } from "./numbers-math";

export interface BusinessCalendar {
  schedules: { effective_from: string; open_weekdays: number[] }[];
  exceptions: { business_date: string; is_open: boolean; reason: string }[];
}

/** null means the shop has no confirmed schedule for this date. */
export function isOpenDay(date: string, calendar: BusinessCalendar): boolean | null {
  const exception = calendar.exceptions.find((entry) => entry.business_date === date);
  if (exception) return exception.is_open;
  const schedule = calendar.schedules
    .filter((entry) => entry.effective_from <= date)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  if (!schedule) return null;
  return schedule.open_weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay());
}

export function openDates(from: string, to: string, calendar: BusinessCalendar): string[] | null {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const open = isOpenDay(date, calendar);
    if (open === null) return null;
    if (open) dates.push(date);
  }
  return dates;
}

/** Never skip an expected open date just because its numbers are missing. */
export function previousOpenDay(today: string, calendar: BusinessCalendar): string | null {
  for (let offset = 1; offset <= 366; offset++) {
    const date = addDays(today, -offset);
    const open = isOpenDay(date, calendar);
    if (open === null) return null;
    if (open) return date;
  }
  return null;
}

export function missingOpenDates(expected: string[], reported: Iterable<string>): string[] {
  const available = new Set(reported);
  return expected.filter((date) => !available.has(date));
}

/** Allocate each month's fixed target by that month's confirmed open dates. */
export function proratedGoal(
  monthly: number,
  from: string,
  to: string,
  calendar: BusinessCalendar,
): number | null {
  const dates = openDates(from, to, calendar);
  if (!dates?.length) return null;
  let result = 0;
  for (const month of new Set(dates.map((date) => date.slice(0, 7)))) {
    const monthDates = openDates(
      `${month}-01`,
      `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
      calendar,
    );
    if (!monthDates?.length) return null;
    result += (monthly * dates.filter((date) => date.startsWith(month)).length) / monthDates.length;
  }
  return result;
}
