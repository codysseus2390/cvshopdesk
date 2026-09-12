-- TV/Display role for shared screens. Value only; not referenced later in this migration.
alter type public.member_role add value if not exists 'display';

-- Per-role permission overrides. Defaults live in application code; rows here are overrides.
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff','display')),
  permission text not null,
  allowed boolean not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (shop_id, role, permission)
);

grant select, insert, update on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;

create policy "shop members read permissions" on public.role_permissions
  for select to authenticated using (public.has_shop_access(shop_id));
create policy "owner writes permissions" on public.role_permissions
  for insert to authenticated with check (public.is_shop_owner(shop_id) and updated_by = auth.uid());
create policy "owner updates permissions" on public.role_permissions
  for update to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- Dashboard visibility and monthly targets, one row per shop.
create table if not exists public.shop_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  hidden_widgets jsonb not null default '[]'::jsonb,
  targets jsonb not null default '{}'::jsonb,
  technician_goals jsonb not null default '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.shop_settings to authenticated;
grant all on public.shop_settings to service_role;
alter table public.shop_settings enable row level security;

create policy "shop members read settings" on public.shop_settings
  for select to authenticated using (public.has_shop_access(shop_id));
create policy "managers create settings" on public.shop_settings
  for insert to authenticated with check (public.is_shop_manager(shop_id));
create policy "managers update settings" on public.shop_settings
  for update to authenticated using (public.is_shop_manager(shop_id)) with check (public.is_shop_manager(shop_id));

-- In-app announcements. Built so a push channel can be added later without reshaping data.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  message text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  audience text not null check (audience in ('all','specific','display','all_display')),
  channels jsonb not null default '["in_app"]'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  target text not null check (target in ('user','display')),
  user_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_recipients_user_idx on public.notification_recipients (shop_id, user_id);
create index if not exists notifications_shop_idx on public.notifications (shop_id, created_at desc);

grant select, insert on public.notifications to authenticated;
grant all on public.notifications to service_role;
grant select, insert, update on public.notification_recipients to authenticated;
grant all on public.notification_recipients to service_role;
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

create policy "recipients and managers read notifications" on public.notifications
  for select to authenticated using (
    public.has_shop_access(shop_id) and (
      public.is_shop_manager(shop_id)
      or exists (
        select 1 from public.notification_recipients r
        where r.notification_id = notifications.id
          and (r.user_id = auth.uid() or r.target = 'display')
      )
    )
  );
create policy "managers create notifications" on public.notifications
  for insert to authenticated with check (public.is_shop_manager(shop_id) and created_by = auth.uid());

create policy "read own or display recipients" on public.notification_recipients
  for select to authenticated using (
    public.has_shop_access(shop_id) and (user_id = auth.uid() or target = 'display' or public.is_shop_manager(shop_id))
  );
create policy "managers create recipients" on public.notification_recipients
  for insert to authenticated with check (public.is_shop_manager(shop_id));
create policy "mark own recipient read" on public.notification_recipients
  for update to authenticated using (public.has_shop_access(shop_id) and user_id = auth.uid())
  with check (public.has_shop_access(shop_id) and user_id = auth.uid());

-- Activity log for important changes.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  actor_id uuid,
  actor_email text,
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_shop_idx on public.audit_events (shop_id, created_at desc);

grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
alter table public.audit_events enable row level security;

create policy "managers read audit events" on public.audit_events
  for select to authenticated using (public.is_shop_manager(shop_id));

-- Audit rows are only written by this routine, so an actor cannot forge entries.
create or replace function public.log_audit_event(p_action text, p_target text default null, p_detail jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_shop uuid;
  v_email text;
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select m.shop_id, m.email into v_shop, v_email from public.shop_members m
    where m.user_id = v_user and m.status = 'approved' limit 1;
  if v_shop is null then raise exception 'No shop access'; end if;
  insert into public.audit_events (shop_id, actor_id, actor_email, action, target, detail)
  values (v_shop, v_user, v_email, p_action, p_target, coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.log_audit_event(text, text, jsonb) from public, anon;
grant execute on function public.log_audit_event(text, text, jsonb) to authenticated;