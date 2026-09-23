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

function scheduleKey(schedule: { open_weekdays: number[] }): string {
  return JSON.stringify([...schedule.open_weekdays].sort((a, b) => a - b));
}

function exceptionKey(exception: { is_open: boolean; reason: string }): string {
  return `${exception.is_open}|${exception.reason}`;
}

/** Effective/exception dates whose stored record differs between two calendar versions. */
function changedRecordDates(
  oldCalendar: BusinessCalendar | null,
  newCalendar: BusinessCalendar,
): string[] {
  const oldSchedules = new Map(
    (oldCalendar?.schedules ?? []).map((s) => [s.effective_from, scheduleKey(s)]),
  );
  const newSchedules = new Map(
    newCalendar.schedules.map((s) => [s.effective_from, scheduleKey(s)]),
  );
  const scheduleDates = new Set([...oldSchedules.keys(), ...newSchedules.keys()]);
  const changedSchedules = [...scheduleDates].filter(
    (date) => oldSchedules.get(date) !== newSchedules.get(date),
  );

  const oldExceptions = new Map(
    (oldCalendar?.exceptions ?? []).map((e) => [e.business_date, exceptionKey(e)]),
  );
  const newExceptions = new Map(
    newCalendar.exceptions.map((e) => [e.business_date, exceptionKey(e)]),
  );
  const exceptionDates = new Set([...oldExceptions.keys(), ...newExceptions.keys()]);
  const changedExceptions = [...exceptionDates].filter(
    (date) => oldExceptions.get(date) !== newExceptions.get(date),
  );

  return [...changedSchedules, ...changedExceptions];
}

/**
 * The earliest date on or before `today` whose open/closed status (per `isOpenDay`)
 * would change if `newCalendar` replaced `oldCalendar`, or null when no confirmed
 * date's status would change. `oldCalendar === null` (no calendar configured yet)
 * never counts as a retroactive change — there is no established status to alter.
 * Scans only from the earliest changed schedule/exception date to `today` (bounded).
 */
export function earliestRetroactiveStatusChange(
  oldCalendar: BusinessCalendar | null,
  newCalendar: BusinessCalendar,
  today: string,
): string | null {
  if (!oldCalendar) return null;
  const changedDates = changedRecordDates(oldCalendar, newCalendar)
    .filter((date) => date <= today)
    .sort();
  if (changedDates.length === 0) return null;
  for (let date = changedDates[0]!; date <= today; date = addDays(date, 1)) {
    if (isOpenDay(date, oldCalendar) !== isOpenDay(date, newCalendar)) return date;
  }
  return null;
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
