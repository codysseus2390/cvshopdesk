-- Keep SECURITY DEFINER surface minimal and self-authorizing.

-- 1) Membership helpers may only report on the calling user, so a signed-in
--    staff member cannot probe other users' shop access.
create or replace function public.has_shop_access(_shop_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = _shop_id
      and m.user_id = _user_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
  );
$$;

create or replace function public.is_shop_owner(_shop_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = _shop_id
      and m.user_id = _user_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
      and m.role = 'owner'
  );
$$;

create or replace function public.is_shop_manager(_shop_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = _shop_id
      and m.user_id = _user_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
      and m.role in ('owner','manager')
  );
$$;

-- 2) Trigger-only and internal routines stay non-executable by API roles.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_member_role() from public, anon, authenticated;
revoke all on function public.guard_import_status() from public, anon, authenticated;
revoke all on function public.save_metric_snapshot(uuid, date, public.report_scope, numeric, integer, integer, public.metric_source, uuid, text, jsonb, text) from public, anon;
revoke all on function public.accept_import_metrics(uuid, jsonb, text) from public, anon;
revoke all on function public.accept_import_records(uuid, text, date, jsonb) from public, anon;
revoke all on function public.add_staff_member(text, public.member_role) from public, anon;
revoke all on function public.bootstrap_shop(text, text) from public, anon;
revoke all on function public.request_shop_access() from public, anon;
revoke all on function public.log_audit_event(text, text, jsonb) from public, anon;
revoke all on function public.has_shop_access(uuid, uuid) from public, anon;
revoke all on function public.is_shop_owner(uuid, uuid) from public, anon;
revoke all on function public.is_shop_manager(uuid, uuid) from public, anon;
revoke all on function public.is_owner_email() from public, anon;

-- 3) Re-grant only the staff RPCs and RLS helpers signed-in staff must call.
grant execute on function public.has_shop_access(uuid, uuid) to authenticated;
grant execute on function public.is_shop_owner(uuid, uuid) to authenticated;
grant execute on function public.is_shop_manager(uuid, uuid) to authenticated;
grant execute on function public.is_owner_email() to authenticated;
