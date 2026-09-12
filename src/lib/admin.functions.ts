import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { APP_ROLES, PERMISSIONS } from "@/lib/permissions";

const permissionKeys = PERMISSIONS.map((p) => p.key) as [string, ...string[]];
const assignableRoles = ["manager", "staff", "display"] as const;

type Supa = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function currentMembership(supabase: unknown, userId: string) {
  const sb = supabase as Supa;
  const { data, error } = await sb
    .from("shop_members")
    .select("shop_id, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "approved") throw new Error("You do not have access to a shop yet.");
  return data as { shop_id: string; role: string; status: string };
}

export interface ShopSettingsPayload {
  hidden_widgets: string[];
  targets: Record<string, number | null>;
  technician_goals: { technician: string; cars_per_month: number | null; gp_per_month: number | null }[];
}

/** Everything the Settings screens need: role, overrides, dashboard settings. */
export const getAdminConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const membership = await currentMembership(context.supabase, context.userId);

    const [{ data: overrides }, { data: settings }] = await Promise.all([
      sb.from("role_permissions").select("role, permission, allowed").eq("shop_id", membership.shop_id),
      sb.from("shop_settings").select("*").eq("shop_id", membership.shop_id).maybeSingle(),
    ]);

    return {
      role: membership.role,
      shopId: membership.shop_id,
      overrides: (overrides ?? []) as { role: string; permission: string; allowed: boolean }[],
      settings: {
        hidden_widgets: (settings?.hidden_widgets ?? []) as string[],
        targets: (settings?.targets ?? {}) as Record<string, number | null>,
        technician_goals: (settings?.technician_goals ?? []) as ShopSettingsPayload["technician_goals"],
        updated_at: (settings?.updated_at ?? null) as string | null,
      },
    };
  });

/** Owner only. Database policies enforce this as well. */
export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        role: z.enum(assignableRoles),
        permission: z.enum(permissionKeys),
        allowed: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const membership = await currentMembership(context.supabase, context.userId);
    if (membership.role !== "owner") throw new Error("Only the owner can change permissions.");

    const { error } = await sb.from("role_permissions").upsert(
      {
        shop_id: membership.shop_id,
        role: data.role,
        permission: data.permission,
        allowed: data.allowed,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id,role,permission" },
    );
    if (error) throw new Error(error.message);

    await sb.rpc("log_audit_event", {
      p_action: "permission_changed",
      p_target: `${data.role}:${data.permission}`,
      p_detail: { allowed: data.allowed },
    });
    return { ok: true };
  });

/** Dashboard visibility and monthly goals. Owner and admins only. */
export const saveShopSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        hidden_widgets: z.array(z.string().max(60)).max(40),
        targets: z.record(z.string().max(60), z.number().nonnegative().nullable()),
        technician_goals: z
          .array(
            z.object({
              technician: z.string().min(1).max(120),
              cars_per_month: z.number().nonnegative().nullable(),
              gp_per_month: z.number().nonnegative().nullable(),
            }),
          )
          .max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const membership = await currentMembership(context.supabase, context.userId);
    if (membership.role !== "owner" && membership.role !== "manager") {
      throw new Error("Only the owner and admins can change dashboard settings.");
    }

    const { error } = await sb.from("shop_settings").upsert(
      {
        shop_id: membership.shop_id,
        hidden_widgets: data.hidden_widgets,
        targets: data.targets,
        technician_goals: data.technician_goals,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id" },
    );
    if (error) throw new Error(error.message);

    await sb.rpc("log_audit_event", {
      p_action: "dashboard_settings_saved",
      p_target: "shop_settings",
      p_detail: { hidden: data.hidden_widgets.length, goals: data.technician_goals.length },
    });
    return { ok: true };
  });

/** Activity log of important changes. Visible to the owner and admins. */
export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_events")
      .select("id, actor_email, action, target, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Roles that exist in the model, for the interface. */
export const KNOWN_ROLES = APP_ROLES;
