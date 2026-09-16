ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS voice_wake_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_wake_phrase text NOT NULL DEFAULT 'Hey Hank',
  ADD COLUMN IF NOT EXISTS voice_wake_sound boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS voice_wake_response boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_wake_timeout_seconds integer NOT NULL DEFAULT 30;

ALTER TABLE public.ai_settings DROP CONSTRAINT IF EXISTS ai_settings_voice_input_mode_check;
ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_voice_input_mode_check
  CHECK (voice_input_mode IN ('auto', 'push', 'wake'));

ALTER TABLE public.ai_settings DROP CONSTRAINT IF EXISTS ai_settings_voice_wake_phrase_check;
ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_voice_wake_phrase_check
  CHECK (char_length(btrim(voice_wake_phrase)) BETWEEN 2 AND 40);

ALTER TABLE public.ai_settings DROP CONSTRAINT IF EXISTS ai_settings_voice_wake_timeout_check;
ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_voice_wake_timeout_check
  CHECK (voice_wake_timeout_seconds BETWEEN 10 AND 300);