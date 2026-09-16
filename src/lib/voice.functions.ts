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

type Supa = { from: (table: string) => any };

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
    code: known ? ((err as { code: string }).code as "unavailable") : ("unavailable" as const),
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
      return { ok: false as const, code: "not_configured" as const, message: "The ElevenLabs account is not connected yet.", voices: [] };
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
    const { data: row } = await sb.from("ai_settings").select("*").eq("shop_id", member.shop_id).maybeSingle();
    const settings = (row ?? {}) as Record<string, unknown>;

    if (!settings["voice_enabled"]) {
      return { ok: false as const, code: "disabled" as const, message: "Hank's voice is turned off in Hank Settings." };
    }
    const voiceId = (settings["voice_id"] as string | null) ?? "";
    if (!voiceId) {
      return { ok: false as const, code: "voice_unavailable" as const, message: "No voice has been chosen for Hank yet." };
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
