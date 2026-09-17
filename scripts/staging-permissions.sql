-- Run only in the verified, empty cvshopdesk-staging dashboard as postgres.
-- This exercises PostgreSQL RLS with simulated authenticated identities;
-- it does not create Auth accounts or replace browser/token tests.
-- All synthetic rows roll back. Any error must also be followed by ROLLBACK.
begin;
set local statement_timeout = '30s';
lock table public.shops, auth.users in share row exclusive mode;
do $$
begin
  if current_user <> 'postgres'
     or exists (select 1 from public.shops)
     or exists (select 1 from auth.users)
     or (select count(*) from drizzle.__drizzle_migrations) <> 22 then
    raise exception 'Refusing test: requires empty staging with 22 source migrations';
  end if;
end $$;

insert into public.shops (id, name, created_by) values
  ('00000000-0000-4000-8000-000000000001', 'Synthetic shop A', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000002', 'Synthetic shop B', '00000000-0000-4000-8000-000000000107');
insert into public.shop_members (shop_id, user_id, role, status)
select '00000000-0000-4000-8000-000000000001'::uuid, uid::uuid,
       role_name::public.member_role, status_name::public.member_status
from (values
  ('00000000-0000-4000-8000-000000000101', 'owner', 'approved'),
  ('00000000-0000-4000-8000-000000000102', 'manager', 'approved'),
  ('00000000-0000-4000-8000-000000000103', 'staff', 'approved'),
  ('00000000-0000-4000-8000-000000000104', 'display', 'approved'),
  ('00000000-0000-4000-8000-000000000105', 'staff', 'pending'),
  ('00000000-0000-4000-8000-000000000106', 'staff', 'revoked')
) as fixture(uid, role_name, status_name);
insert into public.shop_members (shop_id, user_id, role, status) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000107', 'owner', 'approved');
insert into public.customers (shop_id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Synthetic customer A'),
  ('00000000-0000-4000-8000-000000000002', 'Synthetic customer B');
insert into public.role_permissions (shop_id, role, permission, allowed) values
  ('00000000-0000-4000-8000-000000000001', 'staff', 'edit_records', false),
  ('00000000-0000-4000-8000-000000000001', 'display', 'edit_records', false);

set local role authenticated;
do $$
declare
  fixture record;
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  b constant uuid := '00000000-0000-4000-8000-000000000002';
  affected integer;
begin
  for fixture in select * from (values
    ('00000000-0000-4000-8000-000000000101', 1, 0, true, true),
    ('00000000-0000-4000-8000-000000000102', 1, 0, false, true),
    ('00000000-0000-4000-8000-000000000103', 1, 0, false, false),
    ('00000000-0000-4000-8000-000000000104', 1, 0, false, false),
    ('00000000-0000-4000-8000-000000000105', 0, 0, false, false),
    ('00000000-0000-4000-8000-000000000106', 0, 0, false, false),
    ('00000000-0000-4000-8000-000000000107', 0, 1, false, false)
  ) as cases(uid, own_count, other_count, owner_access, manager_access)
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', fixture.uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', fixture.uid, true);
    if auth.uid() <> fixture.uid::uuid
       or (select count(*) from public.customers where shop_id = a) <> fixture.own_count
       or (select count(*) from public.customers where shop_id = b) <> fixture.other_count
       or public.is_shop_owner(a) <> fixture.owner_access
       or public.is_shop_manager(a) <> fixture.manager_access then
      raise exception 'RLS read/helper failure for identity %', fixture.uid;
    end if;
    if fixture.uid <> '00000000-0000-4000-8000-000000000101'
       and public.has_shop_access(a, '00000000-0000-4000-8000-000000000101') then
      raise exception 'Membership helper exposed another identity';
    end if;
    begin
      insert into public.customers (shop_id, name) values (case when fixture.other_count = 1 then a else b end, 'Must be denied');
      raise exception 'Cross-shop insert unexpectedly permitted';
    exception when insufficient_privilege then null;
    end;
  end loop;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
  update public.shop_members set status = 'approved'
    where shop_id = a and user_id = '00000000-0000-4000-8000-000000000105';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Staff approved pending membership'; end if;
  begin
    perform public.save_metric_snapshot(a, current_date, 'daily', 1, 1, 1, 'manual', null, null, null, null);
    raise exception 'Legacy metric RPC unexpectedly executable';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
  update public.shop_members set status = 'approved'
    where shop_id = a and user_id = '00000000-0000-4000-8000-000000000105';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Manager could not approve staff'; end if;
  update public.shop_members set status = 'revoked'
    where shop_id = a and role = 'owner';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Manager changed owner membership'; end if;
  begin
    insert into public.role_permissions (shop_id, role, permission, allowed, updated_by)
      values (a, 'staff', 'synthetic_manager_override', true, auth.uid());
    raise exception 'Manager modified owner-only permission overrides';
  exception when insufficient_privilege then null;
  end;

  -- Compatibility probes of known vulnerabilities, NOT desired authorization.
  -- Tightening these policies should make these probes fail and require revising
  -- this baseline into deny assertions alongside the security fix.
  for fixture in select * from (values
    ('00000000-0000-4000-8000-000000000103', 'staff'),
    ('00000000-0000-4000-8000-000000000104', 'display')
  ) as cases(uid, role_name)
  loop
    perform set_config('request.jwt.claim.sub', fixture.uid, true);
    if not exists (select 1 from public.role_permissions
                   where shop_id = a and role = fixture.role_name
                     and permission = 'edit_records' and not allowed) then
      raise exception 'Missing denied override fixture';
    end if;
    insert into public.customers (shop_id, name) values (a, 'Known override gap: ' || fixture.role_name);
  end loop;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.customers;
    raise exception 'Anonymous customer read unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'RLS isolation checks passed; staff/display write override gaps reproduced' as result,
       (select count(*) from public.shops) as remaining_shops,
       (select count(*) from auth.users) as remaining_auth_users;
