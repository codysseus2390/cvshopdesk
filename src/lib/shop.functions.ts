import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireShopPermission } from "./permissions.server";

export const OWNER_EMAIL = "codysseus2390@gmail.com";

export interface ShopContext {
  shopExists: boolean;
  isOwnerEmail: boolean;
  email: string | null;
  shop: { id: string; name: string; timezone: string } | null;
  membership: { role: string; status: string } | null;
  /** People waiting for approval. Only counted for the owner and managers. */
  pendingCount: number;
}

export const getShopContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShopContext> => {
    const { supabase, userId } = context;
    const { trustedIdentity } = await import("@/lib/owner.server");
    const identity = await trustedIdentity(userId);
    const email = identity.email;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("shops")
      .select("id", { count: "exact", head: true });

    const { data: membership } = await supabase
      .from("shop_members")
      .select("role, status, shop_id")
      .eq("user_id", userId)
      .maybeSingle();

    let shop: ShopContext["shop"] = null;
    if (membership?.status === "approved") {
      const { data } = await supabase
        .from("shops")
        .select("id, name, timezone")
        .eq("id", membership.shop_id)
        .maybeSingle();
      shop = data ?? null;
    }

    let pendingCount = 0;
    if (
      membership?.status === "approved" &&
      (membership.role === "owner" || membership.role === "manager")
    ) {
      const { count: pending } = await supabase
        .from("shop_members")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", membership.shop_id)
        .eq("status", "pending");
      pendingCount = pending ?? 0;
    }

    return {
      shopExists: (count ?? 0) > 0,
      isOwnerEmail: identity.isOwner,
      email,
      shop,
      membership: membership ? { role: membership.role, status: membership.status } : null,
      pendingCount,
    };
  });

/**
 * Only the verified owner email may create the shop, and only once.
 * The shop and its owner membership are created together by one database routine that
 * re-verifies auth.uid() plus the confirmed owner email, takes a lock against races, and
 * is safe to retry (a half-finished setup is repaired rather than duplicated).
 */
export const claimShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().min(2).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { trustedIdentity } = await import("@/lib/owner.server");
    const identity = await trustedIdentity(userId);
    if (!identity.isOwner) {
      throw new Error(
        "Only the shop owner account with a confirmed email address can set up the shop.",
      );
    }

    const { data: shopId, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("bootstrap_shop", { p_name: data.name });
    if (error) throw new Error(error.message);
    if (!shopId)
      throw new Error("Shop setup did not complete. Nothing was saved — please try again.");

    return { shopId: shopId as string };
  });

/**
 * Records a staff access request. One database routine decides the outcome: an
 * employee the owner or a manager already added is approved straight away, anyone
 * else is left pending until an admin approves them.
 */
export const requestAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (
      context.supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("request_shop_access");
    if (error) throw new Error(error.message);
    return (data ?? { status: "pending" }) as { status: string };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shop_members")
      .select("id, email, role, status, requested_at, decided_at, user_id")
      .order("requested_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Pre-authorised employees who have not signed in yet. */
export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("staff_invites")
      .select("id, email, role, created_at, claimed_at")
      .is("claimed_at", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Adds an employee by email. Only the owner or a manager may do this, enforced in
 * the database. Nothing is emailed and no password is created here.
 */
export const addStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ email: z.string().email().max(200), role: z.enum(["manager", "staff", "display"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireShopPermission(context.supabase, context.userId, "manage_staff");
    const { data: result, error } = await (
      context.supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("add_staff_member", { p_email: data.email, p_role: data.role });
    if (error) throw new Error(error.message);
    return (result ?? { status: "invited" }) as { status: "approved" | "invited" };
  });

export const decideMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        status: z.enum(["approved", "revoked"]),
        role: z.enum(["manager", "staff", "display"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const caller = await requireShopPermission(context.supabase, context.userId, "manage_staff");
    // RLS restricts this update to the shop owner. The role is always written
    // explicitly so approving a request can never carry over an escalated role
    // that was submitted with it; the owner row itself is never touched here.
    const { data: updated, error } = await context.supabase
      .from("shop_members")
      .update({
        status: data.status,
        role: data.role ?? "staff",
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
      })
      .eq("id", data.memberId)
      .eq("shop_id", caller.shop_id)
      .neq("role", "owner")
      .select("id");

    if (error) throw new Error(error.message);
    if (updated?.length !== 1) throw new Error("That employee could not be updated.");
    return { ok: true };
  });

/** Changes an employee's role. Database policies limit this to the owner and managers, and the owner row is never touched. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ memberId: z.string().uuid(), role: z.enum(["manager", "staff", "display"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const caller = await requireShopPermission(context.supabase, context.userId, "manage_staff");
    const { data: updated, error } = await context.supabase
      .from("shop_members")
      .update({ role: data.role, decided_at: new Date().toISOString(), decided_by: context.userId })
      .eq("id", data.memberId)
      .eq("shop_id", caller.shop_id)
      .neq("role", "owner")
      .select("id");
    if (error) throw new Error(error.message);
    if (updated?.length !== 1) throw new Error("That employee could not be updated.");
    return { ok: true };
  });

/**
 * Lets the owner or an admin set an employee's sign-in email or password.
 *
 * The caller is checked twice: their membership must be manager/owner of the
 * same shop as the employee, and the owner's own row can only be changed by the
 * owner themselves. Only after those checks does the privileged auth client run
 * the change, and the result is written to the shop's audit history.
 */
export const setMemberCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        email: z.string().email().max(200).optional(),
        password: z.string().min(10).max(72).optional(),
      })
      .refine((v) => Boolean(v.email || v.password), {
        message: "Enter a new email address or a new password.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error: readError } = await context.supabase
      .from("shop_members")
      .select("id, user_id, role, status, shop_id, email")
      .eq("id", data.memberId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!member) throw new Error("That employee is not part of this shop.");

    const caller = await requireShopPermission(context.supabase, context.userId, "manage_staff");
    if (caller.shop_id !== member.shop_id)
      throw new Error("That employee is not part of this shop.");

    if (member.role === "owner" && member.user_id !== context.userId) {
      throw new Error("The owner's sign-in details can only be changed by the owner.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (data.email) {
      payload.email = data.email;
      payload.email_confirm = true;
    }
    if (data.password) payload.password = data.password;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      member.user_id,
      payload,
    );
    if (authError) throw new Error(authError.message);

    if (data.email) {
      const { error: syncError } = await context.supabase
        .from("shop_members")
        .update({ email: data.email })
        .eq("id", member.id);
      if (syncError) throw new Error(syncError.message);
    }

    await (
      context.supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc("log_audit_event", {
      p_action: "staff.credentials_changed",
      p_target: member.id,
      // The password itself is never recorded — only that it was replaced.
      p_detail: {
        previous_email: member.email,
        new_email: data.email ?? null,
        password_changed: Boolean(data.password),
      },
    });

    return { ok: true };
  });
