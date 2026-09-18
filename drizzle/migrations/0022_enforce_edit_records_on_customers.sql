-- Enforce the app's edit_records permission at the database boundary.
-- The previous customer policies checked shop membership only, so staff and
-- display members could write rows even when edit_records was disabled.

create or replace function public.can_edit_records(
  _shop_id uuid,
  _user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id = auth.uid() and exists (
    select 1
    from public.shop_members m
    where m.shop_id = _shop_id
      and m.user_id = _user_id
      and m.status = 'approved'
      and (
        m.role in ('owner', 'manager')
        or coalesce(
          (
            select rp.allowed
            from public.role_permissions rp
            where rp.shop_id = m.shop_id
              and rp.role = m.role::text
              and rp.permission = 'edit_records'
          ),
          false
        )
      )
  );
$$;

revoke all on function public.can_edit_records(uuid, uuid) from public, anon;
grant execute on function public.can_edit_records(uuid, uuid) to authenticated;

drop policy if exists "shop members write customers" on public.customers;
create policy "members with edit permission write customers"
  on public.customers for insert to authenticated
  with check (public.can_edit_records(shop_id));

drop policy if exists "shop members update customers" on public.customers;
create policy "members with edit permission update customers"
  on public.customers for update to authenticated
  using (public.can_edit_records(shop_id))
  with check (public.can_edit_records(shop_id));
