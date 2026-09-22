import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { can, type PermissionKey } from "./permissions";

/** A failed override read is never equivalent to having no overrides. */
export async function readShopPermissions(supabase: unknown, shopId: string, role: string) {
  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from("role_permissions")
    .select("role, permission, allowed")
    .eq("shop_id", shopId);
  if (error) throw new Error("Unable to verify your permissions. Please try again.");
  return (permission: PermissionKey) => can(role, permission, data ?? []);
}
