import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { calendarSchema } from "./calendar.schema";
export async function readBusinessCalendar(supabase: unknown, shopId: string) {
  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from("shop_settings")
    .select("business_calendar")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw new Error("Unable to load the shop calendar.");
  const parsed = calendarSchema.safeParse(data?.business_calendar);
  if (!parsed.success)
    throw new Error("The owner needs to configure the shop's business calendar in Settings.");
  return parsed.data;
}
