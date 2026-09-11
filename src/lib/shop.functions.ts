import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const OWNER_EMAIL = "codysseus2390@gmail.com";

export interface ShopContext {
  shopExists: boolean;
  isOwnerEmail: boolean;
  email: string | null;
  shop: { id: string; name: string; timezone: string } | null;
  membership: { role: string; status: string } | null;
}


export const getShopContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShopContext> => {
    const { supabase, userId } = context;
    const { trustedIdentity } = await import("@/lib/owner.server");
    const identity = await trustedIdentity(userId);
    const email = identity.email;


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("shops").select("id", { count: "exact", head: true });

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

    return {
      shopExists: (count ?? 0) > 0,
      isOwnerEmail: identity.isOwner,
      email,
      shop,
      membership: membership ? { role: membership.role, status: membership.status } : null,
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

    const { data: shopId, error } = await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("bootstrap_shop", { p_name: data.name });
    if (error) throw new Error(error.message);
    if (!shopId) throw new Error("Shop setup did not complete. Nothing was saved — please try again.");

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
    const { data, error } = await (context.supabase as unknown as {
      rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("request_shop_access");
    if (error) throw new Error(error.message);
    return (data ?? { status: "pending" }) as { status: string };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shop_members")
      .select("id, email, role, status, requested_at, decided_at")
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
      .object({ email: z.string().email().max(200), role: z.enum(["manager", "staff"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("add_staff_member", { p_email: data.email, p_role: data.role });
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
        role: z.enum(["manager", "staff"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS restricts this update to the shop owner. The role is always written
    // explicitly so approving a request can never carry over an escalated role
    // that was submitted with it; the owner row itself is never touched here.
    const { error } = await context.supabase
      .from("shop_members")
      .update({
        status: data.status,
        role: data.role ?? "staff",
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
      })
      .eq("id", data.memberId)
      .neq("role", "owner");


    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Changes an employee's role. Database policies limit this to the owner and managers, and the owner row is never touched. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ memberId: z.string().uuid(), role: z.enum(["manager", "staff"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shop_members")
      .update({ role: data.role, decided_at: new Date().toISOString(), decided_by: context.userId })
      .eq("id", data.memberId)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
