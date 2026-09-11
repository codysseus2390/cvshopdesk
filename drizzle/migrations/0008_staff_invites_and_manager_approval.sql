-- Managers act as admins alongside the owner for staff administration.
create or replace function public.is_shop_manager(_shop_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = _shop_id and m.user_id = _user_id
      and m.status = 'approved' and m.role in ('owner','manager')
  );
$$;

-- Pre-authorised staff: the owner/managers add an email here, and that person is
-- approved automatically the first time they sign in. No email is sent from here.
create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'staff',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (shop_id, email)
);

grant select, insert, update on public.staff_invites to authenticated;
grant all on public.staff_invites to service_role;
alter table public.staff_invites enable row level security;

create policy "managers read invites" on public.staff_invites
  for select to authenticated using (public.is_shop_manager(shop_id));
create policy "managers create invites" on public.staff_invites
  for insert to authenticated with check (public.is_shop_manager(shop_id) and created_by = auth.uid() and role <> 'owner');
create policy "managers update invites" on public.staff_invites
  for update to authenticated using (public.is_shop_manager(shop_id)) with check (public.is_shop_manager(shop_id) and role <> 'owner');

-- Managers may decide membership too, but never touch the owner row.
drop policy if exists "owner decides membership" on public.shop_members;
create policy "managers decide membership" on public.shop_members
  for update to authenticated
  using (public.is_shop_manager(shop_id) and role <> 'owner')
  with check (public.is_shop_manager(shop_id) and role <> 'owner');

-- Adding an employee: records the pre-authorisation and, when that person already
-- has an account, approves their membership straight away.
create or replace function public.add_staff_member(p_email text, p_role public.member_role default 'staff')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_shop uuid;
  v_email text := lower(trim(p_email));
  v_target uuid;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_role = 'owner' then raise exception 'The owner role cannot be granted'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select m.shop_id into v_shop from public.shop_members m
   where m.user_id = v_user and m.status = 'approved' and m.role in ('owner','manager') limit 1;
  if v_shop is null then raise exception 'Only the owner or a manager can add staff'; end if;

  insert into public.staff_invites (shop_id, email, role, created_by)
  values (v_shop, v_email, p_role, v_user)
  on conflict (shop_id, email) do update set role = excluded.role, created_by = excluded.created_by;

  select u.id into v_target from auth.users u where lower(trim(u.email)) = v_email limit 1;

  if v_target is not null then
    insert into public.shop_members (shop_id, user_id, email, role, status, decided_at, decided_by)
    values (v_shop, v_target, v_email, p_role, 'approved', now(), v_user)
    on conflict (shop_id, user_id) do update
      set status = case when public.shop_members.role = 'owner' then public.shop_members.status else 'approved' end,
          role = case when public.shop_members.role = 'owner' then public.shop_members.role else p_role end,
          email = coalesce(public.shop_members.email, v_email),
          decided_at = now(), decided_by = v_user;
    update public.staff_invites set claimed_at = now() where shop_id = v_shop and email = v_email;
    return jsonb_build_object('status', 'approved');
  end if;

  return jsonb_build_object('status', 'invited');
end $$;

revoke all on function public.add_staff_member(text, public.member_role) from public, anon;
grant execute on function public.add_staff_member(text, public.member_role) to authenticated;

-- Staff sign-in: approves automatically when pre-authorised, otherwise records a pending request.
create or replace function public.request_shop_access()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_shop uuid;
  v_invite public.staff_invites;
  v_existing public.shop_members;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select lower(trim(u.email)), u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_user;

  select id into v_shop from public.shops order by created_at limit 1;
  if v_shop is null then raise exception 'No shop has been set up yet.'; end if;

  select * into v_existing from public.shop_members where shop_id = v_shop and user_id = v_user;
  if v_existing.id is not null and v_existing.status = 'approved' then
    return jsonb_build_object('status', 'approved');
  end if;

  if v_email is not null and v_confirmed is not null then
    select * into v_invite from public.staff_invites where shop_id = v_shop and email = v_email;
  end if;

  if v_invite.id is not null and v_invite.role <> 'owner' and coalesce(v_existing.status, 'pending') <> 'revoked' then
    insert into public.shop_members (shop_id, user_id, email, role, status, decided_at, decided_by)
    values (v_shop, v_user, v_email, v_invite.role, 'approved', now(), v_invite.created_by)
    on conflict (shop_id, user_id) do update
      set status = 'approved', role = v_invite.role, email = coalesce(public.shop_members.email, v_email),
          decided_at = now(), decided_by = v_invite.created_by;
    update public.staff_invites set claimed_at = now() where id = v_invite.id;
    return jsonb_build_object('status', 'approved');
  end if;

  insert into public.shop_members (shop_id, user_id, email, role, status)
  values (v_shop, v_user, v_email, 'staff', 'pending')
  on conflict (shop_id, user_id) do nothing;

  return jsonb_build_object('status', coalesce(v_existing.status::text, 'pending'));
end $$;

revoke all on function public.request_shop_access() from public, anon;
grant execute on function public.request_shop_access() to authenticated;