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

/** Only the verified owner email may create the shop, and only once. */
export const claimShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().min(2).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { trustedIdentity } = await import("@/lib/owner.server");
    const identity = await trustedIdentity(userId);
    const email = identity.email;
    if (!identity.isOwner) {
      throw new Error(
        "Only the shop owner account with a confirmed email address can set up the shop.",
      );
    }


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("shops").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("A shop has already been set up.");

    // RLS on shops also requires the owner email, so this insert is enforced twice.
    const { data: shop, error } = await supabase
      .from("shops")
      .insert({ name: data.name, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: memberError } = await supabaseAdmin.from("shop_members").insert({
      shop_id: shop.id,
      user_id: userId,
      email,
      role: "owner",
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: userId,
    });
    if (memberError) throw new Error(memberError.message);

    return { shopId: shop.id };
  });

export const requestAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { trustedIdentity } = await import("@/lib/owner.server");
    const email = (await trustedIdentity(userId)).email;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop } = await supabaseAdmin.from("shops").select("id").limit(1).maybeSingle();
    if (!shop) throw new Error("No shop has been set up yet.");

    const { error } = await supabase
      .from("shop_members")
      .insert({ shop_id: shop.id, user_id: userId, email, status: "pending", role: "staff" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
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
    // RLS restricts this update to the shop owner.
    const { error } = await context.supabase
      .from("shop_members")
      .update({
        status: data.status,
        ...(data.role ? { role: data.role } : {}),
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
      })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
