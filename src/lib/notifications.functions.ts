import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Supa = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function membership(supabase: unknown, userId: string) {
  const sb = supabase as Supa;
  const { data, error } = await sb
    .from("shop_members")
    .select("shop_id, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "approved") throw new Error("You do not have access to a shop yet.");
  return data as { shop_id: string; role: string };
}

export const AUDIENCES = ["all", "specific", "display", "all_display"] as const;

/**
 * Creates an announcement and its recipient rows. Recipients are stored per person
 * (and once for the shared display), so a push channel can be added later without
 * changing this shape — `channels` records where it was intended to go.
 */
export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(2).max(140),
        message: z.string().min(2).max(2000),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
        audience: z.enum(AUDIENCES),
        userIds: z.array(z.string().uuid()).max(200).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const member = await membership(context.supabase, context.userId);
    if (member.role !== "owner" && member.role !== "manager") {
      throw new Error("Only the owner and admins can send announcements.");
    }

    let recipientUserIds: string[] = [];
    if (data.audience === "all" || data.audience === "all_display") {
      const { data: members, error } = await sb
        .from("shop_members")
        .select("user_id, role")
        .eq("shop_id", member.shop_id)
        .eq("status", "approved");
      if (error) throw new Error(error.message);
      recipientUserIds = (members ?? [])
        .filter((m: { role: string }) => m.role !== "display")
        .map((m: { user_id: string }) => m.user_id);
    } else if (data.audience === "specific") {
      if (data.userIds.length === 0) throw new Error("Choose at least one employee.");
      const { data: members, error } = await sb
        .from("shop_members")
        .select("user_id")
        .eq("shop_id", member.shop_id)
        .eq("status", "approved")
        .in("user_id", data.userIds);
      if (error) throw new Error(error.message);
      recipientUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
      if (recipientUserIds.length === 0) throw new Error("Those employees are not approved staff.");
    }

    const toDisplay = data.audience === "display" || data.audience === "all_display";

    const { data: created, error: insertError } = await sb
      .from("notifications")
      .insert({
        shop_id: member.shop_id,
        title: data.title,
        message: data.message,
        priority: data.priority,
        audience: data.audience,
        channels: ["in_app"],
        created_by: context.userId,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (insertError) throw new Error(insertError.message);
    if (!created?.id) throw new Error("The announcement was not saved. Nothing was sent.");

    const rows = [
      ...recipientUserIds.map((user_id) => ({
        notification_id: created.id,
        shop_id: member.shop_id,
        target: "user",
        user_id,
      })),
      ...(toDisplay
        ? [
            {
              notification_id: created.id,
              shop_id: member.shop_id,
              target: "display",
              user_id: null,
            },
          ]
        : []),
    ];

    if (rows.length > 0) {
      const { error: recipientError } = await sb.from("notification_recipients").insert(rows);
      if (recipientError)
        throw new Error(`Saved, but recipients failed: ${recipientError.message}`);
    }

    await sb.rpc("log_audit_event", {
      p_action: "notification_sent",
      p_target: created.id,
      p_detail: { audience: data.audience, recipients: rows.length, priority: data.priority },
    });

    return { ok: true, id: created.id as string, recipients: rows.length };
  });

/** The signed-in employee's own announcements, newest first, with read state. */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const { data, error } = await sb
      .from("notification_recipients")
      .select(
        "id, read_at, target, notification:notifications(id, title, message, priority, created_at, audience)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      read_at: string | null;
      target: string;
      notification: {
        id: string;
        title: string;
        message: string;
        priority: string;
        created_at: string;
        audience: string;
      } | null;
    }[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ recipientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const { error } = await sb
      .from("notification_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.recipientId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Announcements queued for the shared TV screen. */
export const listDisplayNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const { data, error } = await sb
      .from("notification_recipients")
      .select("id, notification:notifications(id, title, message, priority, created_at)")
      .eq("target", "display")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      notification: {
        id: string;
        title: string;
        message: string;
        priority: string;
        created_at: string;
      } | null;
    }[];
  });

/** Approved staff, for choosing specific recipients. */
export const listNotificationAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shop_members")
      .select("user_id, email, role")
      .eq("status", "approved")
      .order("email", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Shop announcements shown on the dashboard and in its history. */
export const listShopAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const member = await membership(context.supabase, context.userId);
    const { data: notifications, error } = await sb
      .from("notifications")
      .select("id, title, message, priority, audience, created_at")
      .eq("shop_id", member.shop_id)
      .in("audience", ["all", "display", "all_display"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (notifications ?? []) as {
      id: string; title: string; message: string; priority: string;
      audience: string; created_at: string;
    }[];
    if (rows.length === 0) return [];
    const { data: recipients, error: recipientError } = await sb
      .from("notification_recipients")
      .select("id, notification_id")
      .eq("shop_id", member.shop_id)
      .eq("target", "display");
    if (recipientError) throw new Error(recipientError.message);
    const displayIds = new Map(
      ((recipients ?? []) as { id: string; notification_id: string }[])
        .map((row) => [row.notification_id, row.id]),
    );
    return rows.map((notification) => ({
      id: displayIds.get(notification.id) ?? notification.id,
      on_tv: displayIds.has(notification.id),
      notification,
    }));
  });

/** Update a queued TV announcement without changing who received it. */
export const updateDisplayNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      notificationId: z.string().uuid(),
      title: z.string().trim().min(2).max(140),
      message: z.string().trim().min(2).max(2000),
      priority: z.enum(["low", "normal", "high"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const member = await membership(context.supabase, context.userId);
    if (member.role !== "owner" && member.role !== "manager") {
      throw new Error("Only the owner and admins can edit TV announcements.");
    }
    const { data: updated, error } = await sb
      .from("notifications")
      .update({ title: data.title, message: data.message, priority: data.priority })
      .eq("id", data.notificationId)
      .eq("shop_id", member.shop_id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated?.id) throw new Error("This announcement is no longer on the TV.");
    await sb.rpc("log_audit_event", {
      p_action: "tv_notification_edited",
      p_target: data.notificationId,
    });
    return { ok: true };
  });

/** Remove only the TV recipient, keeping the saved announcement and staff copies. */
export const removeDisplayNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ recipientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const member = await membership(context.supabase, context.userId);
    if (member.role !== "owner" && member.role !== "manager") {
      throw new Error("Only the owner and admins can remove TV announcements.");
    }
    const { data: removed, error } = await sb
      .from("notification_recipients")
      .delete()
      .eq("id", data.recipientId)
      .eq("shop_id", member.shop_id)
      .eq("target", "display")
      .select("id, notification_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!removed?.id) throw new Error("This announcement is no longer on the TV.");
    await sb.rpc("log_audit_event", {
      p_action: "tv_notification_removed",
      p_target: removed.notification_id,
    });
    return { ok: true };
  });
