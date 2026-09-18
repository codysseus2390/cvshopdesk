/**
 * Hank voice server functions. Everything that touches ElevenLabs runs here,
 * behind sign-in; the browser only ever receives audio bytes or a message.
 *
 * Reading out an answer is available to any approved staff member. Changing
 * the shop's saved voice configuration stays with the owner and admins, and is
 * handled by the existing Hank Settings save function.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { HANK_TTS_MAX_CHARS, HANK_TTS_MIME } from "@/lib/ai/voice-config";
import { resolvePermissions, type AppRole } from "@/lib/permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = { from: (table: string) => any };

async function membership(sb: Supa, userId: string) {
  const { data, error } = await sb
    .from("shop_members")
    .select("shop_id, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "approved") throw new Error("You do not have access to a shop yet.");
  const { data: overrides, error: overrideError } = await sb
    .from("role_permissions")
    .select("role, permission, allowed")
    .eq("shop_id", data.shop_id);
  if (overrideError) throw new Error(overrideError.message);
  const permissions = resolvePermissions(data.role as AppRole, (overrides ?? []) as never);
  return {
    shop_id: data.shop_id as string,
    role: data.role as string,
    canUseAssistant: permissions.use_assistant,
  };
}

function requireAssistant(member: { canUseAssistant: boolean }) {
  if (!member.canUseAssistant) throw new Error("The AI assistant is not enabled for your role.");
}

function requireManager(role: string) {
  if (role !== "owner" && role !== "manager") {
    throw new Error("Only the owner and admins can change Hank's voice.");
  }
}

function toBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

/** Turns any voice failure into a safe, useful message. */
function failure(err: unknown) {
  const known = err instanceof Error && err.name === "VoiceServiceError";
  return {
    ok: false as const,
    code: known
      ? ((err as unknown as { code: string }).code as "unavailable")
      : ("unavailable" as const),
    message:
      err instanceof Error && err.message
        ? err.message
        : "Hank's voice could not be produced just now.",
  };
}

/** The voices the connected ElevenLabs account can use, fetched live. */
export const listHankVoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await membership(context.supabase as unknown as Supa, context.userId);
    requireManager(member.role);
    const { listElevenLabsVoices, isVoiceConfigured } = await import("@/lib/ai/elevenlabs.server");
    if (!isVoiceConfigured()) {
      return {
        ok: false as const,
        code: "not_configured" as const,
        message: "The ElevenLabs account is not connected yet.",
        voices: [],
      };
    }
    try {
      return { ok: true as const, voices: await listElevenLabsVoices() };
    } catch (err) {
      return { ...failure(err), voices: [] };
    }
  });

const tuningSchema = z.object({
  voiceId: z.string().trim().min(1).max(120),
  speed: z.number().min(0.5).max(1.5),
  stability: z.number().min(0).max(1),
  similarity: z.number().min(0).max(1),
  style: z.number().min(0).max(1),
  speakerBoost: z.boolean(),
});

/** Reads out one of Hank's answers using the shop's saved voice configuration. */
export const speakHankText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().trim().min(1).max(HANK_TTS_MAX_CHARS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa;
    const member = await membership(sb, context.userId);
    requireAssistant(member);
    const { data: row } = await sb
      .from("ai_settings")
      .select("*")
      .eq("shop_id", member.shop_id)
      .maybeSingle();
    const settings = (row ?? {}) as Record<string, unknown>;

    if (!settings["voice_enabled"]) {
      return {
        ok: false as const,
        code: "disabled" as const,
        message: "Hank's voice is turned off in Hank Settings.",
      };
    }
    const voiceId = (settings["voice_id"] as string | null) ?? "";
    if (!voiceId) {
      return {
        ok: false as const,
        code: "voice_unavailable" as const,
        message: "No voice has been chosen for Hank yet.",
      };
    }

    const { synthesizeSpeech } = await import("@/lib/ai/elevenlabs.server");
    try {
      const audio = await synthesizeSpeech({
        text: data.text,
        voiceId,
        speed: Number(settings["voice_speed"] ?? 1),
        stability: Number(settings["voice_stability"] ?? 0.5),
        similarity: Number(settings["voice_similarity"] ?? 0.75),
        style: Number(settings["voice_style"] ?? 0),
        speakerBoost: settings["voice_speaker_boost"] !== false,
      });
      return { ok: true as const, mimeType: HANK_TTS_MIME, audioBase64: toBase64(audio) };
    } catch (err) {
      return failure(err);
    }
  });

/** Test / preview a voice with unsaved settings. Owner and admins only. */
export const testHankVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tuningSchema.extend({ text: z.string().trim().min(1).max(1_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const member = await membership(context.supabase as unknown as Supa, context.userId);
    requireManager(member.role);
    const { synthesizeSpeech } = await import("@/lib/ai/elevenlabs.server");
    try {
      const audio = await synthesizeSpeech({
        text: data.text,
        voiceId: data.voiceId,
        speed: data.speed,
        stability: data.stability,
        similarity: data.similarity,
        style: data.style,
        speakerBoost: data.speakerBoost,
      });
      return { ok: true as const, mimeType: HANK_TTS_MIME, audioBase64: toBase64(audio) };
    } catch (err) {
      return failure(err);
    }
  });

/**
 * Voice Mode's listening step: a recorded clip in, written words out.
 *
 * Available to approved members with the use_assistant permission, because the
 * transcript is then sent through the ordinary Hank chat function, so
 * personality, tools, permissions, confirmations and audit logging all apply
 * exactly as they do when the same words are typed.
 */
export const transcribeHankSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        mimeType: z.string().trim().min(3).max(80),
        audioBase64: z.string().min(16),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const member = await membership(context.supabase as unknown as Supa, context.userId);
    requireAssistant(member);
    const { HANK_STT_MAX_BYTES } = await import("@/lib/ai/voice-config");
    const audio = Buffer.from(data.audioBase64, "base64");
    if (audio.byteLength < 1_200) {
      return {
        ok: false as const,
        code: "audio" as const,
        message: "That recording was empty. Try speaking again.",
      };
    }
    if (audio.byteLength > HANK_STT_MAX_BYTES) {
      return {
        ok: false as const,
        code: "audio" as const,
        message: "That recording is too long. Say it in a shorter stretch.",
      };
    }
    const { transcribeAudio } = await import("@/lib/ai/transcribe.server");
    try {
      const text = await transcribeAudio({ audio: new Uint8Array(audio), mimeType: data.mimeType });
      return { ok: true as const, text };
    } catch (err) {
      return {
        ok: false as const,
        code: "unavailable" as const,
        message: err instanceof Error ? err.message : "That could not be understood just now.",
      };
    }
  });

/**
 * Saves the shop's voice configuration. Owner and admins only — the same
 * permission that guards the rest of Hank Settings.
 */
export const saveHankVoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        autoSpeak: z.boolean(),
        voiceId: z.string().trim().max(120).nullable().default(null),
        voiceName: z.string().trim().max(120).nullable().default(null),
        speed: z.number().min(0.5).max(1.5),
        stability: z.number().min(0).max(1),
        similarity: z.number().min(0).max(1),
        style: z.number().min(0).max(1),
        speakerBoost: z.boolean(),
        inputMode: z.enum(["auto", "push", "wake"]).default("auto"),
        autoListen: z.boolean().default(true),
        wakeEnabled: z.boolean().default(false),
        wakePhrase: z.string().trim().min(2).max(40).default("Hey Hank"),
        wakeSound: z.boolean().default(true),
        wakeResponse: z.boolean().default(false),
        wakeTimeoutSeconds: z.number().int().min(10).max(300).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Supa & {
      rpc: (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };
    const member = await membership(sb, context.userId);
    requireManager(member.role);

    const { error } = await sb.from("ai_settings").upsert(
      {
        shop_id: member.shop_id,
        voice_enabled: data.enabled,
        voice_auto_speak: data.autoSpeak,
        voice_id: data.voiceId,
        voice_name: data.voiceName,
        voice_speed: data.speed,
        voice_stability: data.stability,
        voice_similarity: data.similarity,
        voice_style: data.style,
        voice_speaker_boost: data.speakerBoost,
        voice_input_mode: data.inputMode,
        voice_auto_listen: data.autoListen,
        voice_wake_enabled: data.wakeEnabled,
        voice_wake_phrase: data.wakePhrase,
        voice_wake_sound: data.wakeSound,
        voice_wake_response: data.wakeResponse,
        voice_wake_timeout_seconds: data.wakeTimeoutSeconds,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id" },
    );
    if (error) throw new Error(error.message);

    await sb.rpc("log_audit_event", {
      p_action: "hank_voice_settings_saved",
      p_target: "ai_settings",
      p_detail: { enabled: data.enabled, auto_speak: data.autoSpeak, voice_name: data.voiceName },
    });
    return { ok: true as const };
  });
