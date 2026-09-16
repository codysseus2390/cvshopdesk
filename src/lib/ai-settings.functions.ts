/**
 * Hank Settings: identity, personality (developer instructions), behaviour
 * toggles, model tier and which action tools are allowed.
 *
 * Personality text is stored in the database as developer/system instruction
 * text and has its own, much larger, limit than ordinary chat messages.
 * API keys are never stored or returned here — they stay in server secrets.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SHOP_AI_MAX_PERSONALITY_CHARS } from "@/lib/ai/model-config";
import { ASSISTANT_SETTINGS_DEFAULTS, type AssistantSettings } from "@/lib/ai/persona";

type Supa = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function membership(sb: Supa, userId: string) {
  const { data, error } = await sb
    .from("shop_members")
    .select("shop_id, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "approved") throw new Error("You do not have access to a shop yet.");
  return data as { shop_id: string; role: string };
}

function fromRow(row: Record<string, unknown> | null | undefined): AssistantSettings {
  if (!row) return ASSISTANT_SETTINGS_DEFAULTS;
  return {
    assistantName: (row["assistant_name"] as string) || ASSISTANT_SETTINGS_DEFAULTS.assistantName,
    subtitle: (row["subtitle"] as string) || ASSISTANT_SETTINGS_DEFAULTS.subtitle,
    avatarUrl: (row["avatar_url"] as string | null) ?? null,
    personality: (row["personality"] as string) ?? "",
    casualLanguage: Boolean(row["casual_language"]),
    humor: Boolean(row["humor"]),
    mildProfanity: Boolean(row["mild_profanity"]),
    shopBanter: Boolean(row["shop_banter"]),
    customerFacingProfessional: Boolean(row["customer_facing_professional"]),
    modelTier: (row["model_tier"] as string) || ASSISTANT_SETTINGS_DEFAULTS.modelTier,
    disabledTools: (row["disabled_tools"] as string[]) ?? [],
    visionEnabled: Boolean(row["vision_enabled"]),
    updatedAt: (row["updated_at"] as string | null) ?? null,
  };
}

/** Server-side read used by the assistant itself. */
export async function loadAssistantSettings(supabase: unknown, shopId: string): Promise<AssistantSettings> {
  const sb = supabase as Supa;
  const { data } = await sb.from("ai_settings").select("*").eq("shop_id", shopId).maybeSingle();
  return fromRow(data as Record<string, unknown> | null);
}

/** Any approved staff member may read the identity/behaviour configuration. */
export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Supa;
    const member = await membership(sb, context.userId);
    const settings = await loadAssistantSettings(context.supabase, member.shop_id);
    const { shopAiToolCatalogue } = await import("@/lib/ai/tools.server");
    const { SHOP_AI_ACCEPTED_TYPES, SHOP_AI_MAX_FILE_BYTES, SHOP_AI_MAX_FILES } = await import(
      "@/lib/shop-ai.limits"
    );
    return {
      role: member.role,
      settings,
      tools: shopAiToolCatalogue(),
      attachments: {
        types: [...SHOP_AI_ACCEPTED_TYPES],
        maxFileBytes: SHOP_AI_MAX_FILE_BYTES,
        maxFiles: SHOP_AI_MAX_FILES,
      },
      /** True when the OpenAI secret is present. The value itself is never returned. */
      apiKeyConfigured: Boolean(process.env["OPENAI_API_KEY"]),
    };
  });

/** Owner and admins only, matching the app's existing settings permissions. */
export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assistantName: z.string().trim().min(1).max(40),
        subtitle: z.string().trim().max(80).default(""),
        avatarUrl: z.string().trim().max(500).nullable().default(null),
        personality: z.string().max(SHOP_AI_MAX_PERSONALITY_CHARS).default(""),
        casualLanguage: z.boolean(),
        humor: z.boolean(),
        mildProfanity: z.boolean(),
        shopBanter: z.boolean(),
        customerFacingProfessional: z.boolean(),
        modelTier: z.enum(["fast", "standard", "deep"]),
        disabledTools: z.array(z.string().max(80)).max(80).default([]),
        visionEnabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const member = await membership(sb, context.userId);
    if (member.role !== "owner" && member.role !== "manager") {
      throw new Error("Only the owner and admins can change Hank's settings.");
    }

    const { error } = await sb.from("ai_settings").upsert(
      {
        shop_id: member.shop_id,
        assistant_name: data.assistantName,
        subtitle: data.subtitle,
        avatar_url: data.avatarUrl,
        personality: data.personality,
        casual_language: data.casualLanguage,
        humor: data.humor,
        mild_profanity: data.mildProfanity,
        shop_banter: data.shopBanter,
        customer_facing_professional: data.customerFacingProfessional,
        model_tier: data.modelTier,
        disabled_tools: data.disabledTools,
        vision_enabled: data.visionEnabled,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id" },
    );
    if (error) throw new Error(error.message);

    await sb.rpc("log_audit_event", {
      p_action: "ai_settings_saved",
      p_target: "ai_settings",
      p_detail: {
        personality_chars: data.personality.length,
        model_tier: data.modelTier,
        disabled_tools: data.disabledTools.length,
      },
    });
    return { ok: true as const };
  });
