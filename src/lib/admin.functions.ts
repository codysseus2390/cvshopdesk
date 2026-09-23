import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { APP_ROLES, PERMISSIONS, can, canReadAuditEvents } from "@/lib/permissions";
import type { GoalRules } from "@/lib/numbers-math";
import { readShopPermissions } from "./permissions.server";
import { requireShopPermission } from "./permissions.server";
import { calendarSchema, saveBusinessCalendarInputSchema } from "./calendar.schema";
import { readBusinessCalendarLenient } from "./calendar.server";
import { earliestRetroactiveStatusChange } from "./business-calendar";
import { resolveShopTimeZone } from "./timezone";
import { shopToday } from "./metrics-math";

const permissionKeys = PERMISSIONS.map((p) => p.key) as [string, ...string[]];
const assignableRoles = ["manager", "staff", "display"] as const;

type Supa = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
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
  technician_goals: {
    technician: string;
    cars_per_month: number | null;
    gp_per_month: number | null;
  }[];
}

/** Everything the Settings screens need: role, overrides, dashboard settings. */
export const getAdminConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const membership = await currentMembership(context.supabase, context.userId);

    const [{ data: overrides, error: permissionError }, { data: settings, error: settingsError }] =
      await Promise.all([
        sb
          .from("role_permissions")
          .select("role, permission, allowed")
          .eq("shop_id", membership.shop_id),
        sb.from("shop_settings").select("*").eq("shop_id", membership.shop_id).maybeSingle(),
      ]);
    if (permissionError) throw new Error("Unable to verify your permissions. Please try again.");
    if (settingsError) throw new Error("Unable to load shop settings. Please try again.");

    const resolvedOverrides = (overrides ?? []) as {
      role: string;
      permission: string;
      allowed: boolean;
    }[];
    // technician_goals is productivity config: never send it to a caller who is
    // not allowed to see productivity data, even though it lives in the same
    // shop_settings row as non-productivity dashboard config.
    const canViewProductivity = can(membership.role, "view_productivity", resolvedOverrides);

    return {
      role: membership.role,
      shopId: membership.shop_id,
      overrides: resolvedOverrides,
      settings: {
        business_calendar: calendarSchema.safeParse(settings?.business_calendar).data ?? null,
        hidden_widgets: (settings?.hidden_widgets ?? []) as string[],
        targets: (settings?.targets ?? {}) as Record<string, number | null>,
        goal_rules: (settings?.goal_rules ?? {}) as GoalRules,
        technician_goals: canViewProductivity
          ? ((settings?.technician_goals ?? []) as ShopSettingsPayload["technician_goals"])
          : [],
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
    if (!can(membership.role, "manage_permissions")) {
      throw new Error("Only the owner can change permissions.");
    }

    const { data: saved, error } = await sb
      .from("role_permissions")
      .upsert(
        {
          shop_id: membership.shop_id,
          role: data.role,
          permission: data.permission,
          allowed: data.allowed,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop_id,role,permission" },
      )
      .select("shop_id");
    if (error) throw new Error(error.message);
    if (!saved || saved.length === 0) {
      throw new Error("The permission change was not saved. Nothing was changed.");
    }

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
    const allowed = await readShopPermissions(
      context.supabase,
      membership.shop_id,
      membership.role,
    );
    if (!allowed("change_settings")) {
      throw new Error("You do not have permission to change dashboard settings.");
    }

    const { data: saved, error } = await sb
      .from("shop_settings")
      .upsert(
        {
          shop_id: membership.shop_id,
          hidden_widgets: data.hidden_widgets,
          targets: data.targets,
          technician_goals: data.technician_goals,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop_id" },
      )
      .select("shop_id");
    if (error) throw new Error(error.message);
    if (!saved || saved.length === 0) {
      throw new Error("Dashboard settings were not saved. Nothing was changed.");
    }

    await sb.rpc("log_audit_event", {
      p_action: "dashboard_settings_saved",
      p_target: "shop_settings",
      p_detail: { hidden: data.hidden_widgets.length, goals: data.technician_goals.length },
    });
    return { ok: true };
  });

/**
 * Activity log of important changes. Visible to the owner and admins only — a
 * deliberate, non-overridable invariant (see `canReadAuditEvents` in
 * permissions.ts and the matching SQL comment on migration 0023's
 * "managers read audit events" policy).
 */
export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const membership = await currentMembership(context.supabase, context.userId);
    if (!canReadAuditEvents(membership.role)) {
      throw new Error("You do not have permission to view the audit log.");
    }
    const { data, error } = await context.supabase
      .from("audit_events")
      .select("id, actor_email, action, target, detail, created_at")
      .eq("shop_id", membership.shop_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Roles that exist in the model, for the interface. */
export const KNOWN_ROLES = APP_ROLES;

/**
 * Retroactive-edit guard: rejects a schedule/exception write that would change the
 * open/closed status of a date on or before the shop's local today unless the
 * caller sends `confirmRetroactive: true`. Forward-dated changes always save
 * without it. The confirmed retroactive marking is carried through to the
 * save_business_calendar() RPC, which sets it as a transaction-local Postgres
 * setting so the 0024 trigger's audit row records it distinctly (see migration
 * 0024_business_calendar.sql).
 */
export const saveBusinessCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => saveBusinessCalendarInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const member = await requireShopPermission(context.supabase, context.userId, "manage_security");
    const sb = context.supabase as unknown as Supa;

    const { data: shopRow, error: shopError } = await sb
      .from("shops")
      .select("timezone")
      .eq("id", member.shop_id)
      .maybeSingle();
    if (shopError) throw new Error("Unable to verify the shop's timezone. Please try again.");
    const timezone = resolveShopTimeZone(shopRow?.timezone as string | null | undefined);
    const today = shopToday(timezone);

    const oldCalendar = await readBusinessCalendarLenient(context.supabase, member.shop_id);
    const conflictDate = earliestRetroactiveStatusChange(oldCalendar, data.calendar, today);
    if (conflictDate && !data.confirmRetroactive) {
      throw new Error(
        `This change would alter the recorded open/closed status of ${conflictDate} (and possibly other dates on or before today, ${today}). Confirm to save this retroactive change anyway.`,
      );
    }

    const { error } = await sb.rpc("save_business_calendar", {
      p_shop_id: member.shop_id,
      p_business_calendar: data.calendar,
      p_retroactive: Boolean(conflictDate),
      p_retroactive_from: conflictDate,
    });
    if (error) throw new Error("The calendar could not be saved. Please try again.");
    return { ok: true, retroactive: Boolean(conflictDate) };
  });
