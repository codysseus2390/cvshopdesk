import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Temporary Showcase Mode access layer.
 *
 * A visitor who knows the shared passcode is signed in as one dedicated
 * read-only "TV / Display" member account. No new authentication system and no
 * weakened database rules: the visitor is a genuine Supabase user whose row
 * level security is limited to the display role. Removing this file and the
 * SHOWCASE_PASSCODE secret turns the whole feature off.
 */

export const SHOWCASE_EMAIL = "showcase@cedarvalleytire.com";

export const getShowcaseStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { enabled: Boolean(process.env["SHOWCASE_PASSCODE"]) };
});

export const enterShowcase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ passcode: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env["SHOWCASE_PASSCODE"];
    if (!expected) throw new Error("Showcase Mode is switched off.");
    if (data.passcode.trim() !== expected.trim()) throw new Error("That passcode is not correct.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or create the single showcase visitor account.
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) throw new Error("Showcase access is unavailable right now.");
    let user = list.users.find((u) => u.email?.toLowerCase() === SHOWCASE_EMAIL);

    if (!user) {
      const password = crypto.randomUUID() + crypto.randomUUID();
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: SHOWCASE_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { showcase: true, display_name: "Showcase visitor" },
      });
      if (createError || !created.user) throw new Error("Showcase access could not be prepared.");
      user = created.user;
    }

    // Read-only display membership in the existing shop.
    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!shop) throw new Error("The shop has not been set up yet.");

    const { data: membership } = await supabaseAdmin
      .from("shop_members")
      .select("id, role, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      const { error: insertError } = await supabaseAdmin.from("shop_members").insert({
        shop_id: shop.id,
        user_id: user.id,
        email: SHOWCASE_EMAIL,
        role: "display",
        status: "approved",
      });
      if (insertError) throw new Error("Showcase access could not be prepared.");
    } else if (membership.role !== "display" || membership.status !== "approved") {
      const { error: updateError } = await supabaseAdmin
        .from("shop_members")
        .update({ role: "display", status: "approved" })
        .eq("id", membership.id);
      if (updateError) throw new Error("Showcase access could not be prepared.");
    }

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: SHOWCASE_EMAIL,
    });
    if (linkError || !link.properties?.hashed_token) {
      throw new Error("Showcase access could not be prepared.");
    }

    return { email: SHOWCASE_EMAIL, tokenHash: link.properties.hashed_token };
  });
