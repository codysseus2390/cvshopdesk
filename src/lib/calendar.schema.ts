import { z } from "zod";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid date.");
export const calendarSchema = z
  .object({
    schedules: z
      .array(
        z.object({
          effective_from: date,
          open_weekdays: z.array(z.number().int().min(0).max(6)).max(7),
        }),
      )
      .min(1)
      .max(100),
    exceptions: z
      .array(
        z.object({ business_date: date, is_open: z.boolean(), reason: z.string().min(1).max(140) }),
      )
      .max(2000),
  })
  .refine(
    (value) =>
      new Set(value.schedules.map((s) => s.effective_from)).size === value.schedules.length &&
      new Set(value.exceptions.map((e) => e.business_date)).size === value.exceptions.length,
    "Each effective date and exception date must be unique.",
  );

/**
 * saveBusinessCalendar's input: the calendar plus an explicit opt-in the caller
 * must set when it knowingly alters the open/closed status of a date on or before
 * the shop's local today (the retroactive-edit guard in admin.functions.ts decides
 * whether this flag was actually required; forward-dated changes never need it).
 */
export const saveBusinessCalendarInputSchema = z.object({
  calendar: calendarSchema,
  confirmRetroactive: z.boolean().optional(),
});
