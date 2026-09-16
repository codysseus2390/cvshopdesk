alter table public.ai_settings
  add column if not exists voice_input_mode text not null default 'auto',
  add column if not exists voice_auto_listen boolean not null default true;

alter table public.ai_settings
  drop constraint if exists ai_settings_voice_input_mode_check;

alter table public.ai_settings
  add constraint ai_settings_voice_input_mode_check
  check (voice_input_mode in ('auto', 'push'));