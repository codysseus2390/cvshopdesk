alter table public.ai_settings
  add column if not exists voice_enabled boolean not null default false,
  add column if not exists voice_auto_speak boolean not null default false,
  add column if not exists voice_id text,
  add column if not exists voice_name text,
  add column if not exists voice_speed numeric(4,2) not null default 1.0,
  add column if not exists voice_stability numeric(4,3) not null default 0.5,
  add column if not exists voice_similarity numeric(4,3) not null default 0.75,
  add column if not exists voice_style numeric(4,3) not null default 0.0,
  add column if not exists voice_speaker_boost boolean not null default true;