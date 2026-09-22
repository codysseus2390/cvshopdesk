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

export async function requireShopPermission(
  supabase: unknown,
  userId: string,
  permission: PermissionKey,
) {
  const { data, error } = await (supabase as SupabaseClient<Database>)
    .from("shop_members")
    .select("shop_id, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to verify your shop membership. Please try again.");
  if (!data || data.status !== "approved") throw new Error("You do not have access to a shop yet.");
  const allowed = await readShopPermissions(supabase, data.shop_id, data.role);
  if (!allowed(permission)) throw new Error("You do not have permission to do that.");
  return data;
}
