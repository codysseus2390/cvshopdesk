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
