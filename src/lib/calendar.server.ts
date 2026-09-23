import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { calendarSchema } from "./calendar.schema";
import type { BusinessCalendar } from "./business-calendar";

/** Postgres/PostgREST codes that mean "the business_calendar column doesn't exist". */
const MIGRATION_NOT_APPLIED_CODES = new Set(["42703", "PGRST204"]);

/**
 * Thrown when migration 0024_business_calendar has not been applied to this
 * environment. Distinct from "calendar not configured" (null) and "calendar
 * malformed" (owner needs to fix it in Settings) — callers must not fall back to
 * a guessed calendar or guessed metrics for this case.
 */
export class CalendarMigrationNotAppliedError extends Error {
  constructor() {
    super(
      "Shop calendar unavailable: the database update 0024_business_calendar has not been applied to this environment.",
    );
    this.name = "CalendarMigrationNotAppliedError";
  }
}

function isMigrationNotAppliedError(error: PostgrestError): boolean {
  if (error.code && MIGRATION_NOT_APPLIED_CODES.has(error.code)) return true;
  // PostgREST schema-cache variants sometimes surface as a message instead of one
  // of the codes above; match the same underlying "column not found" condition.
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  return /business_calendar/i.test(message) && /(column|schema cache)/i.test(message);
}

/**
 * Reads and validates the shop's business calendar.
 *
 * (a) The business_calendar column doesn't exist (migration 0024 unapplied):
 *     throws CalendarMigrationNotAppliedError. No fallback, no guessed calendar.
 * (b) The query succeeds but business_calendar is null (owner hasn't configured
 *     one yet): returns null. Callers fall back to their existing no-calendar
 *     legacy behavior (e.g. legacy "Previous day" labeling).
 * (c) A configured, schema-valid calendar: returns it. A malformed non-null value
 *     keeps the existing "owner needs to configure" throw.
 */
export async function readBusinessCalendar(
  supabase: unknown,
  shopId: string,
): Promise<BusinessCalendar | null> {
  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from("shop_settings")
    .select("business_calendar")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) {
    if (isMigrationNotAppliedError(error)) throw new CalendarMigrationNotAppliedError();
    throw new Error("Unable to load the shop calendar.");
  }
  if (data?.business_calendar === null || data?.business_calendar === undefined) return null;
  const parsed = calendarSchema.safeParse(data.business_calendar);
  if (!parsed.success)
    throw new Error("The owner needs to configure the shop's business calendar in Settings.");
  return parsed.data;
}

/**
 * Same read as `readBusinessCalendar`, but tolerant of a malformed stored value —
 * used only to compute a diff baseline (e.g. the retroactive-edit guard) where a
 * malformed prior value should be treated as "no established baseline" rather than
 * blocking the write that would fix it. The migration-not-applied case still throws.
 */
export async function readBusinessCalendarLenient(
  supabase: unknown,
  shopId: string,
): Promise<BusinessCalendar | null> {
  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from("shop_settings")
    .select("business_calendar")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) {
    if (isMigrationNotAppliedError(error)) throw new CalendarMigrationNotAppliedError();
    throw new Error("Unable to load the current shop calendar. Please try again.");
  }
  const parsed = calendarSchema.safeParse(data?.business_calendar);
  return parsed.success ? parsed.data : null;
}
