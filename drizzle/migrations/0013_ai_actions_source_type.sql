-- Record where an AI-initiated change came from (image, text, import).
alter table public.ai_actions add column if not exists source_type text;
alter table public.ai_actions add column if not exists proposal jsonb;