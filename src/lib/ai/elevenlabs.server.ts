/**
 * Server-only ElevenLabs speech service for Hank.
 *
 * The API key never leaves this module's process: it is read from server
 * secrets inside each call, is never returned, logged or stored, and never
 * appears in an error message. Everything the browser sees is either audio
 * bytes or a plain-language message.
 *
 * This is Hank's voice layer only. It knows nothing about OpenAI, tools,
 * personality or shop data, so speech-to-text and two-way conversation can be
 * added alongside it later without touching the assistant itself.
 */
import {
  HANK_TTS_MAX_CHARS,
  HANK_TTS_MODEL,
  HANK_TTS_OUTPUT_FORMAT,
  HANK_VOICE_LIMITS,
  type HankVoiceOption,
} from "./voice-config";

const API_ROOT = "https://api.elevenlabs.io";

/** A voice failure the caller can safely show to a person. */
export class VoiceServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "credentials"
      | "quota"
      | "voice_unavailable"
      | "invalid_settings"
      | "unavailable",
  ) {
    super(message);
    this.name = "VoiceServiceError";
  }
}

function apiKey(): string {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) {
    throw new VoiceServiceError(
      "Hank's voice service is not connected yet. An owner needs to connect the ElevenLabs account.",
      "not_configured",
    );
  }
  return key;
}

export function isVoiceConfigured(): boolean {
  return Boolean(process.env["ELEVENLABS_API_KEY"]);
}

/** Maps a provider failure onto a safe message. Never includes response bodies. */
function mapFailure(status: number, body: string): VoiceServiceError {
  const hint = body.toLowerCase();
  if (status === 401 || status === 403) {
    return new VoiceServiceError(
      "The ElevenLabs account details were rejected. An owner needs to reconnect the voice account.",
      "credentials",
    );
  }
  if (status === 429 || hint.includes("quota") || hint.includes("credit")) {
    return new VoiceServiceError(
      "The ElevenLabs account is out of speech credits, or too many requests came at once. Hank's text answer is still fine.",
      "quota",
    );
  }
  if (status === 404 || hint.includes("voice_not_found")) {
    return new VoiceServiceError(
      "The saved voice is no longer available in ElevenLabs. Pick another voice in Hank Settings.",
      "voice_unavailable",
    );
  }
  if (status === 422 || status === 400) {
    return new VoiceServiceError(
      "Those voice settings were not accepted. Try resetting them to the voice defaults.",
      "invalid_settings",
    );
  }
  return new VoiceServiceError(
    "Hank's voice service could not be reached just now. His written answer is unaffected.",
    "unavailable",
  );
}

async function call(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), "xi-api-key": apiKey() },
    });
  } catch {
    throw new VoiceServiceError(
      "Hank's voice service could not be reached. Check the connection and try again.",
      "unavailable",
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw mapFailure(response.status, body);
  }
  return response;
}

function label(labels: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = labels?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * Every voice the connected ElevenLabs account can use, including its own
 * cloned/saved voices. Nothing about the list is hard-coded, so a voice created
 * in ElevenLabs shows up here as soon as the list is refreshed.
 */
export async function listElevenLabsVoices(): Promise<HankVoiceOption[]> {
  const voices: HankVoiceOption[] = [];
  let nextPageToken: string | null = null;

  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ page_size: "100" });
    if (nextPageToken) query.set("next_page_token", nextPageToken);
    const response = await call(`/v2/voices?${query.toString()}`, { method: "GET" });
    const payload = (await response.json()) as {
      voices?: Record<string, unknown>[];
      has_more?: boolean;
      next_page_token?: string | null;
    };

    for (const raw of payload.voices ?? []) {
      const labels = (raw["labels"] as Record<string, unknown> | null) ?? null;
      voices.push({
        voiceId: String(raw["voice_id"] ?? ""),
        name: String(raw["name"] ?? "Unnamed voice"),
        description: (raw["description"] as string | null) ?? null,
        category: (raw["category"] as string | null) ?? null,
        accent: label(labels, "accent"),
        age: label(labels, "age"),
        gender: label(labels, "gender"),
        useCase: label(labels, "use_case") ?? label(labels, "description"),
        previewUrl: (raw["preview_url"] as string | null) ?? null,
      });
    }

    if (!payload.has_more || !payload.next_page_token) break;
    nextPageToken = payload.next_page_token;
  }

  return voices.filter((voice) => voice.voiceId.length > 0);
}

function clamp(value: number, key: keyof typeof HANK_VOICE_LIMITS): number {
  const { min, max } = HANK_VOICE_LIMITS[key];
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface SpeakInput {
  text: string;
  voiceId: string;
  speed: number;
  stability: number;
  similarity: number;
  style: number;
  speakerBoost: boolean;
}

/**
 * Generates speech on demand and returns the bytes. Nothing is stored: normal
 * conversation audio is produced fresh each time it is asked for.
 */
export async function synthesizeSpeech(input: SpeakInput): Promise<ArrayBuffer> {
  const text = input.text.trim().slice(0, HANK_TTS_MAX_CHARS);
  if (text.length === 0) {
    throw new VoiceServiceError("There is nothing to read out.", "invalid_settings");
  }
  if (!input.voiceId) {
    throw new VoiceServiceError(
      "No voice has been chosen for Hank yet. Pick one in Hank Settings.",
      "voice_unavailable",
    );
  }

  // The streaming endpoint starts returning audio while it is still speaking.
  const response = await call(
    `/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/stream?output_format=${HANK_TTS_OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: HANK_TTS_MODEL,
        voice_settings: {
          stability: clamp(input.stability, "stability"),
          similarity_boost: clamp(input.similarity, "similarity"),
          style: clamp(input.style, "style"),
          use_speaker_boost: input.speakerBoost,
          speed: clamp(input.speed, "speed"),
        },
      }),
    },
  );

  return response.arrayBuffer();
}
