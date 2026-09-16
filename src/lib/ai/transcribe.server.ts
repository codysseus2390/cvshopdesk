/**
 * Server-only speech-to-text for Hank's Voice Mode.
 *
 * Uses the same OpenAI account (OPENAI_API_KEY) that already powers Hank's
 * answers — no extra provider. The key stays in this module; the browser only
 * ever receives the transcript or a plain-language message.
 *
 * Kept deliberately small and separate so the model, or the whole provider,
 * can be swapped later without touching Hank, his tools or the microphone UI.
 */
import { HANK_STT_MODEL, HANK_STT_PROMPT } from "./voice-config";

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

export class TranscribeError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "credentials" | "quota" | "audio" | "unavailable",
  ) {
    super(message);
    this.name = "TranscribeError";
  }
}

export function isTranscribeConfigured(): boolean {
  return Boolean(process.env["OPENAI_API_KEY"]);
}

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/**
 * Turns a recorded clip into text. Nothing is stored: the audio is forwarded
 * once and discarded.
 */
export async function transcribeAudio(input: { audio: Uint8Array; mimeType: string }): Promise<string> {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) {
    throw new TranscribeError(
      "Voice Mode is not configured yet. The OPENAI_API_KEY secret is needed for listening as well as answering.",
      "not_configured",
    );
  }
  const base = input.mimeType.split(";")[0]!.trim().toLowerCase();
  const extension = EXTENSIONS[base];
  if (!extension) {
    throw new TranscribeError("That recording format cannot be read. Try a different microphone or browser.", "audio");
  }

  const form = new FormData();
  form.append("model", HANK_STT_MODEL);
  // The file name must match the real container, or the audio is rejected.
  form.append("file", new Blob([input.audio as unknown as BlobPart], { type: base }), `speech.${extension}`);
  // Steers spelling of shop words, tire sizes and names. It never adds content.
  form.append("prompt", HANK_STT_PROMPT);

  let response: Response;
  try {
    response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } catch {
    throw new TranscribeError("Could not reach the listening service. Check the connection and try again.", "unavailable");
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new TranscribeError("The OpenAI key was rejected, so Voice Mode cannot listen right now.", "credentials");
    }
    if (status === 429) {
      throw new TranscribeError("The OpenAI account is rate limited or out of credit. Try again in a moment.", "quota");
    }
    if (status === 400 || status === 413 || status === 422) {
      throw new TranscribeError("That recording could not be understood. Try speaking again, a little closer to the microphone.", "audio");
    }
    throw new TranscribeError("The listening service had a problem. Hank's typed chat still works normally.", "unavailable");
  }

  const payload = (await response.json().catch(() => null)) as { text?: string } | null;
  return (payload?.text ?? "").trim();
}
