-- 1) Ownership must never depend on client-editable user_metadata.
-- Require an authenticated session, then read the trusted, confirmed email
-- from auth.users server-side.
create or replace function public.is_owner_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(trim(u.email)) = 'codysseus2390@gmail.com'
  );
$$;

-- 2) Self-service membership requests may only ever ask for staff access.
drop policy if exists "request own membership" on public.shop_members;
create policy "request own membership" on public.shop_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'::public.member_status
    and role = 'staff'::public.member_role
  );

-- 3) The owner role belongs only to the account that created the shop.
-- Blocks a pending 'owner' request from being approved or promoted later,
-- and applies to service_role writes too (triggers are not bypassed by RLS).
create or replace function public.enforce_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner'::public.member_role then
    if not exists (
      select 1 from public.shops s
      where s.id = new.shop_id and s.created_by = new.user_id
    ) then
      raise exception 'Only the account that created the shop may hold the owner role';
    end if;
  end if;

  -- An existing owner row cannot be silently downgraded by a member update.
  if tg_op = 'UPDATE' and old.role = 'owner'::public.member_role
     and new.role <> 'owner'::public.member_role then
    raise exception 'The shop owner role cannot be reassigned';
  end if;

  return new;
end $$;

drop trigger if exists shop_members_role_guard on public.shop_members;
create trigger shop_members_role_guard
  before insert or update on public.shop_members
  for each row execute function public.enforce_member_role();