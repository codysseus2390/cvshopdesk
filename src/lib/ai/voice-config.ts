/**
 * Central Hank voice (ElevenLabs) configuration.
 * Change the speech model or tuning defaults here only — no UI or backend
 * code hard-codes a model or a voice id.
 */

/** Low-latency speech model, chosen because Hank is interactive. */
export const HANK_TTS_MODEL = "eleven_flash_v2_5";

/** Audio format requested from ElevenLabs and played in the browser. */
export const HANK_TTS_OUTPUT_FORMAT = "mp3_44100_128";
export const HANK_TTS_MIME = "audio/mpeg";

/** Longest single stretch of text turned into speech in one request. */
export const HANK_TTS_MAX_CHARS = 5_000;

export const HANK_VOICE_TUNING_DEFAULTS = {
  speed: 1.0,
  stability: 0.5,
  similarity: 0.75,
  style: 0.0,
  speakerBoost: true,
} as const;

export const HANK_VOICE_LIMITS = {
  speed: { min: 0.7, max: 1.2, step: 0.05 },
  stability: { min: 0, max: 1, step: 0.05 },
  similarity: { min: 0, max: 1, step: 0.05 },
  style: { min: 0, max: 1, step: 0.05 },
} as const;

export const HANK_VOICE_TEST_PHRASE = "Well, I'll be damned. They finally gave me a voice.";

/* ---------- Listening (Voice Mode) ---------- */

/** Speech-to-text model. Runs on the same OpenAI account as Hank's answers. */
export const HANK_STT_MODEL = "gpt-4o-mini-transcribe";

/** Longest single recorded clip accepted, in bytes (~2 minutes of speech). */
export const HANK_STT_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Spelling hints for shop language. This only steers how spoken words are
 * written down; it never adds anything that was not said.
 */
export const HANK_STT_PROMPT =
  "Automotive service shop conversation. Expect tire sizes like 275/65R18 and P225/60R17, brands such as Cooper, " +
  "Michelin, BFGoodrich, Goodyear; vehicle years, makes and models such as Silverado, F-150, RAV4, Tahoe; VIN " +
  "characters, mileage, alignment, brake rotors, TPMS, gross profit, car count, work order, technician and customer " +
  "names, percentages and dollar amounts.";

/** How the microphone behaves in Voice Mode. */
export type HankVoiceInputMode = "auto" | "push" | "wake";

/* ---------- Wake word ("Hey Hank") ---------- */

export const HANK_WAKE_DEFAULT_PHRASE = "Hey Hank";
export const HANK_WAKE_PHRASE_LIMITS = { min: 2, max: 40 } as const;
export const HANK_WAKE_TIMEOUT_LIMITS = { min: 10, max: 300, step: 5 } as const;
export const HANK_WAKE_TIMEOUT_DEFAULT = 30;

/** Short spoken acknowledgements, used only when Activation Response is on. */
export const HANK_WAKE_ACKS = ["Yeah?", "What's up?", "I'm listening."] as const;

export interface HankVoiceSettings {
  enabled: boolean;
  autoSpeak: boolean;
  voiceId: string | null;
  voiceName: string | null;
  speed: number;
  stability: number;
  similarity: number;
  style: number;
  speakerBoost: boolean;
  inputMode: HankVoiceInputMode;
  autoListen: boolean;
}

export const HANK_VOICE_DEFAULTS: HankVoiceSettings = {
  enabled: false,
  autoSpeak: false,
  voiceId: null,
  voiceName: null,
  speed: HANK_VOICE_TUNING_DEFAULTS.speed,
  stability: HANK_VOICE_TUNING_DEFAULTS.stability,
  similarity: HANK_VOICE_TUNING_DEFAULTS.similarity,
  style: HANK_VOICE_TUNING_DEFAULTS.style,
  speakerBoost: HANK_VOICE_TUNING_DEFAULTS.speakerBoost,
  inputMode: "auto",
  autoListen: true,
};

/** One voice as the settings screen shows it. Shape is provider-neutral. */
export interface HankVoiceOption {
  voiceId: string;
  name: string;
  description: string | null;
  category: string | null;
  accent: string | null;
  age: string | null;
  gender: string | null;
  useCase: string | null;
  previewUrl: string | null;
}
