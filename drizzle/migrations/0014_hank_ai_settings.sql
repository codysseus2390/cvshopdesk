create table if not exists public.ai_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  assistant_name text not null default 'Hank',
  subtitle text not null default 'Shop Assistant',
  avatar_url text,
  personality text not null default '',
  casual_language boolean not null default true,
  humor boolean not null default true,
  mild_profanity boolean not null default false,
  shop_banter boolean not null default false,
  customer_facing_professional boolean not null default true,
  model_tier text not null default 'fast',
  disabled_tools text[] not null default '{}',
  vision_enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select on public.ai_settings to authenticated;
grant insert, update on public.ai_settings to authenticated;
grant all on public.ai_settings to service_role;

alter table public.ai_settings enable row level security;

drop policy if exists ai_settings_select on public.ai_settings;
create policy ai_settings_select on public.ai_settings
  for select to authenticated using (public.has_shop_access(shop_id));

drop policy if exists ai_settings_insert on public.ai_settings;
create policy ai_settings_insert on public.ai_settings
  for insert to authenticated with check (public.is_shop_manager(shop_id));

drop policy if exists ai_settings_update on public.ai_settings;
create policy ai_settings_update on public.ai_settings
  for update to authenticated
  using (public.is_shop_manager(shop_id))
  with check (public.is_shop_manager(shop_id));