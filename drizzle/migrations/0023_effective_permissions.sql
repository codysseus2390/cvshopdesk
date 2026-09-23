-- Effective permission checks match src/lib/permissions.ts. Never trust a caller's user id.
create or replace function public.has_shop_permission(_shop_id uuid, _permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = _shop_id and m.user_id = auth.uid() and m.status = 'approved'
      and _permission in ('view_dashboard','edit_dashboard_numbers','upload_imports',
        'approve_imports','edit_records','view_productivity','manage_staff',
        'manage_notifications','access_tools','use_assistant','change_settings',
        'manage_permissions','manage_security')
      and case
        when m.role = 'owner' then true
        when _permission in ('manage_permissions','manage_security') then false
        else coalesce(
          (select rp.allowed from public.role_permissions rp
            where rp.shop_id = m.shop_id and rp.role = m.role::text and rp.permission = _permission),
          case m.role::text
            when 'manager' then true
            when 'staff' then _permission in ('view_dashboard','edit_dashboard_numbers','upload_imports','access_tools','use_assistant')
            when 'display' then _permission = 'view_dashboard'
            else false end)
        end
  );
$$;
revoke all on function public.has_shop_permission(uuid,text) from public, anon;
grant execute on function public.has_shop_permission(uuid,text) to authenticated;

create or replace function public.can_edit_records(_shop_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id = auth.uid() and public.has_shop_permission(_shop_id, 'edit_records');
$$;
revoke all on function public.can_edit_records(uuid,uuid) from public, anon;
grant execute on function public.can_edit_records(uuid,uuid) to authenticated;

-- Restrictive policies intersect existing ownership/shop checks instead of opening
-- a second permissive path. Definer RPCs require separate guards below.
-- Deliberate scope decision: customers/vehicles/inventory_items/shop_jobs/tire_orders
-- SELECT stays membership-scoped (has_shop_access via each table's existing "shop
-- members read ..." permissive policy). Only writes are tied to edit_records here;
-- these are record-editing tables, not the financial/AI reads Deadbolt gap 6 flagged,
-- and no permission key currently distinguishes "can view records" from plain membership.
do $$
declare t text;
begin
  foreach t in array array['customers','vehicles','inventory_items','shop_jobs','tire_orders'] loop
    execute format('create policy effective_permission_insert on public.%I as restrictive for insert to authenticated with check (public.has_shop_permission(shop_id, ''edit_records''))', t);
    execute format('create policy effective_permission_update on public.%I as restrictive for update to authenticated using (public.has_shop_permission(shop_id, ''edit_records'')) with check (public.has_shop_permission(shop_id, ''edit_records''))', t);
    execute format('create policy effective_permission_delete on public.%I as restrictive for delete to authenticated using (public.has_shop_permission(shop_id, ''edit_records''))', t);
  end loop;
end $$;

-- tire_orders DELETE previously stayed on the old is_shop_manager permissive policy
-- (Deadbolt BLOCKER 5), so an explicit edit_records grant to a non-manager staff
-- member could not actually delete an order. Route it through the same effective
-- permission the restrictive policies above already use.
alter policy "managers delete tire orders" on public.tire_orders
  using (public.has_shop_permission(shop_id, 'edit_records'));

create policy effective_productivity_read on public.technician_productivity as restrictive
  for select to authenticated using (public.has_shop_permission(shop_id, 'view_productivity'));
create policy effective_productivity_history_read on public.metric_corrections as restrictive
  for select to authenticated using (
    (field <> 'mechanic_productivity' and field not like 'productivity:%')
    or public.has_shop_permission(shop_id, 'view_productivity'));
create policy effective_productivity_insert on public.technician_productivity as restrictive
  for insert to authenticated with check (public.has_shop_permission(shop_id, 'edit_dashboard_numbers'));
create policy effective_productivity_update on public.technician_productivity as restrictive
  for update to authenticated using (public.has_shop_permission(shop_id, 'edit_dashboard_numbers'))
  with check (public.has_shop_permission(shop_id, 'edit_dashboard_numbers'));

-- Deadbolt gap 6: financial history, raw import extraction, and the AI action log
-- were only membership-scoped, so a revoked view_dashboard/upload_imports/use_assistant
-- override still let a signed-in shop member read them. Tie the read to the same
-- permission the corresponding write/feature already uses.
create policy effective_dashboard_read on public.metric_snapshots as restrictive
  for select to authenticated using (public.has_shop_permission(shop_id, 'view_dashboard'));
-- Keeps the existing productivity-field restriction above (effective_productivity_history_read)
-- in addition to this general dashboard-read gate; restrictive policies AND together.
create policy effective_corrections_read on public.metric_corrections as restrictive
  for select to authenticated using (public.has_shop_permission(shop_id, 'view_dashboard'));
create policy effective_ai_actions_read on public.ai_actions as restrictive
  for select to authenticated using (public.has_shop_permission(shop_id, 'use_assistant'));

create policy effective_settings_insert on public.shop_settings as restrictive
  for insert to authenticated with check (public.has_shop_permission(shop_id, 'change_settings'));
create policy effective_settings_update on public.shop_settings as restrictive
  for update to authenticated using (public.has_shop_permission(shop_id, 'change_settings'))
  with check (public.has_shop_permission(shop_id, 'change_settings'));
create policy effective_notifications_insert on public.notifications as restrictive
  for insert to authenticated with check (public.has_shop_permission(shop_id, 'manage_notifications'));

create policy effective_import_insert on public.imports as restrictive
  for insert to authenticated with check (public.has_shop_permission(shop_id, 'upload_imports'));
create policy effective_import_update on public.imports as restrictive
  for update to authenticated using (public.has_shop_permission(shop_id, 'upload_imports') or public.has_shop_permission(shop_id, 'approve_imports'))
  with check (public.has_shop_permission(shop_id, 'upload_imports') or public.has_shop_permission(shop_id, 'approve_imports'));
create policy effective_import_read on public.imports as restrictive
  for select to authenticated using (public.has_shop_permission(shop_id, 'upload_imports') or public.has_shop_permission(shop_id, 'approve_imports'));

-- Replace older role-only permissive policies so explicit grants work too.
alter policy "managers create settings" on public.shop_settings
  with check (public.has_shop_permission(shop_id, 'change_settings'));
alter policy "managers update settings" on public.shop_settings
  using (public.has_shop_permission(shop_id, 'change_settings'))
  with check (public.has_shop_permission(shop_id, 'change_settings'));
alter policy "managers create notifications" on public.notifications
  with check (public.has_shop_permission(shop_id, 'manage_notifications') and created_by = auth.uid());
alter policy "recipients and managers read notifications" on public.notifications
  using (public.has_shop_access(shop_id) and (
    public.has_shop_permission(shop_id, 'manage_notifications') or exists (
      select 1 from public.notification_recipients r where r.notification_id = notifications.id
      and r.shop_id = notifications.shop_id and (r.user_id = auth.uid() or r.target = 'display'))));
alter policy "managers create recipients" on public.notification_recipients
  with check (public.has_shop_permission(shop_id, 'manage_notifications') and exists (
    select 1 from public.notifications n where n.id = notification_id and n.shop_id = notification_recipients.shop_id)
    and ((target = 'display' and user_id is null) or (target = 'user' and exists (
      select 1 from public.shop_members m where m.shop_id = notification_recipients.shop_id
      and m.user_id = notification_recipients.user_id and m.status = 'approved'))));
alter policy "read own or display recipients" on public.notification_recipients
  using (public.has_shop_access(shop_id) and (user_id = auth.uid() or target = 'display'
    or public.has_shop_permission(shop_id, 'manage_notifications')));
alter policy "managers read invites" on public.staff_invites
  using (public.has_shop_permission(shop_id, 'manage_staff'));
alter policy "managers create invites" on public.staff_invites
  with check (public.has_shop_permission(shop_id, 'manage_staff') and created_by = auth.uid() and role <> 'owner');
alter policy "managers update invites" on public.staff_invites
  using (public.has_shop_permission(shop_id, 'manage_staff'))
  with check (public.has_shop_permission(shop_id, 'manage_staff') and role <> 'owner');
alter policy "managers decide membership" on public.shop_members
  using (public.has_shop_permission(shop_id, 'manage_staff') and role <> 'owner')
  with check (public.has_shop_permission(shop_id, 'manage_staff') and role <> 'owner');
alter policy "shop members upload files" on storage.objects
  with check (bucket_id = 'shop-uploads' and public.has_shop_permission(((storage.foldername(name))[1])::uuid, 'upload_imports'));
-- INSERT above was already migrated; UPDATE/DELETE were still is_shop_manager
-- (Deadbolt WARNING 9). Route them through the same upload_imports permission.
alter policy "shop managers update uploads" on storage.objects
  using (bucket_id = 'shop-uploads' and public.has_shop_permission(((storage.foldername(name))[1])::uuid, 'upload_imports'))
  with check (bucket_id = 'shop-uploads' and public.has_shop_permission(((storage.foldername(name))[1])::uuid, 'upload_imports'));
alter policy "shop managers delete uploads" on storage.objects
  using (bucket_id = 'shop-uploads' and public.has_shop_permission(((storage.foldername(name))[1])::uuid, 'upload_imports'));

-- ai_settings INSERT/UPDATE were still is_shop_manager (Deadbolt BLOCKER 2); route
-- through change_settings, the same permission the app-level save check uses.
alter policy ai_settings_insert on public.ai_settings
  with check (public.has_shop_permission(shop_id, 'change_settings'));
alter policy ai_settings_update on public.ai_settings
  using (public.has_shop_permission(shop_id, 'change_settings'))
  with check (public.has_shop_permission(shop_id, 'change_settings'));

-- audit_events SELECT deliberately stays on is_shop_manager rather than a named
-- PermissionKey: it is an owner/manager-only invariant, not a grantable/revocable
-- permission like the others above. P12-02 adds a matching named TS helper
-- (e.g. canReadAuditEvents(role)) documented with a comment cross-referencing this one.
comment on policy "managers read audit events" on public.audit_events is
  'Deliberate owner/manager invariant, not permission-key-gated. See P12-02''s canReadAuditEvents(role) helper in src/lib/permissions.ts.';

-- Definer functions bypass RLS, so their operation guards are explicit.
CREATE OR REPLACE FUNCTION public.save_shop_metrics(
  p_shop_id uuid,
  p_business_date date,
  p_scope report_scope,
  p_sales numeric,
  p_gross_profit numeric,
  p_tires_sold integer,
  p_car_count integer,
  p_source metric_source,
  p_import_id uuid,
  p_note text,
  p_flags jsonb,
  p_correction_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_prev public.metric_snapshots;
  v_new_id uuid;
begin
  if v_user is null or not public.has_shop_permission(p_shop_id, 'edit_dashboard_numbers') then
    raise exception 'Not authorized for this shop';
  end if;

  select * into v_prev from public.metric_snapshots
  where shop_id = p_shop_id and business_date = p_business_date and scope = p_scope and is_current
  for update;

  insert into public.metric_snapshots (shop_id, business_date, scope, sales, gross_profit, tires_sold,
    car_count, source, import_id, entered_by, note, flags, is_current)
  values (p_shop_id, p_business_date, p_scope, p_sales, p_gross_profit, p_tires_sold, p_car_count,
    p_source, p_import_id, v_user, p_note, coalesce(p_flags, '[]'::jsonb), false)
  returning id into v_new_id;

  if v_prev.id is not null then
    update public.metric_snapshots
      set is_current = false, superseded_at = now(), superseded_by = v_new_id
      where id = v_prev.id;

    insert into public.metric_corrections (shop_id, business_date, scope, field, previous_value,
      new_value, previous_snapshot_id, new_snapshot_id, corrected_by, note)
    select p_shop_id, p_business_date, p_scope, f.field, f.prev, f.new_v, v_prev.id, v_new_id, v_user, p_correction_note
    from (
      values
        ('sales', v_prev.sales::text, p_sales::text),
        ('gross_profit', v_prev.gross_profit::text, p_gross_profit::text),
        ('tires_sold', v_prev.tires_sold::text, p_tires_sold::text),
        ('car_count', v_prev.car_count::text, p_car_count::text)
    ) as f(field, prev, new_v)
    where coalesce(f.prev,'~') <> coalesce(f.new_v,'~');
  end if;

  update public.metric_snapshots set is_current = true where id = v_new_id;
  return v_new_id;
end $function$;
-- Deadbolt WARNING 10: default PUBLIC execute on a SECURITY DEFINER function is not
-- currently exploitable here (auth.uid() is null for anon/unauthenticated callers and
-- the guard above raises), but it is inconsistent with every other definer function in
-- this file and trips the Supabase advisor. Make the deny explicit.
revoke all on function public.save_shop_metrics(uuid, date, public.report_scope, numeric, numeric, integer, integer, public.metric_source, uuid, text, jsonb, text) from public, anon;
grant execute on function public.save_shop_metrics(uuid, date, public.report_scope, numeric, numeric, integer, integer, public.metric_source, uuid, text, jsonb, text) to authenticated;

CREATE OR REPLACE FUNCTION public.save_period_productivity(
  p_shop_id uuid,
  p_business_date date,
  p_technician text,
  p_productivity_pct numeric,
  p_period_scope text,
  p_correction_scope report_scope,
  p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_prev numeric;
  v_id uuid;
begin
  if v_user is null or not public.has_shop_permission(p_shop_id, 'edit_dashboard_numbers') then
    raise exception 'Not authorized for this shop';
  end if;
  if p_period_scope not in ('weekly','monthly','yearly') then
    raise exception 'Unsupported period scope';
  end if;

  select productivity_pct, id into v_prev, v_id from public.technician_productivity
  where shop_id = p_shop_id and business_date = p_business_date
    and technician = p_technician and period_scope = p_period_scope
  for update;

  if v_id is not null then
    update public.technician_productivity
      set productivity_pct = p_productivity_pct, note = p_note, updated_at = now()
      where id = v_id;
  else
    insert into public.technician_productivity (shop_id, business_date, technician, productivity_pct,
      period_scope, note, entered_by)
    values (p_shop_id, p_business_date, p_technician, p_productivity_pct, p_period_scope, p_note, v_user)
    returning id into v_id;
  end if;

  if coalesce(v_prev::text,'~') <> coalesce(p_productivity_pct::text,'~') then
    insert into public.metric_corrections (shop_id, business_date, scope, field, previous_value,
      new_value, corrected_by, note)
    values (p_shop_id, p_business_date, p_correction_scope, 'productivity:' || p_technician,
      v_prev::text, p_productivity_pct::text, v_user, p_note);
  end if;

  return v_id;
end $function$;
revoke all on function public.save_period_productivity(uuid, date, text, numeric, text, public.report_scope, text) from public, anon;
grant execute on function public.save_period_productivity(uuid, date, text, numeric, text, public.report_scope, text) to authenticated;

create or replace function public._save_metric_snapshot(
  p_shop_id uuid, p_business_date date, p_scope public.report_scope,
  p_gross_profit numeric, p_tires_sold integer, p_car_count integer,
  p_source public.metric_source, p_import_id uuid, p_note text, p_flags jsonb,
  p_correction_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_prev public.metric_snapshots;
  v_new_id uuid;
begin
  if v_user is null or not public.has_shop_access(p_shop_id, v_user) then
    raise exception 'Not authorized for this shop';
  end if;

  select * into v_prev from public.metric_snapshots
  where shop_id = p_shop_id and business_date = p_business_date and scope = p_scope and is_current
  for update;

  insert into public.metric_snapshots (shop_id, business_date, scope, gross_profit, tires_sold,
    car_count, source, import_id, entered_by, note, flags, is_current)
  values (p_shop_id, p_business_date, p_scope, p_gross_profit, p_tires_sold, p_car_count,
    p_source, p_import_id, v_user, p_note, coalesce(p_flags, '[]'::jsonb), false)
  returning id into v_new_id;

  if v_prev.id is not null then
    update public.metric_snapshots
      set is_current = false, superseded_at = now(), superseded_by = v_new_id
      where id = v_prev.id;

    insert into public.metric_corrections (shop_id, business_date, scope, field, previous_value,
      new_value, previous_snapshot_id, new_snapshot_id, corrected_by, note)
    select p_shop_id, p_business_date, p_scope, f.field, f.prev, f.new_v, v_prev.id, v_new_id, v_user, p_correction_note
    from (
      values
        ('gross_profit', v_prev.gross_profit::text, p_gross_profit::text),
        ('tires_sold', v_prev.tires_sold::text, p_tires_sold::text),
        ('car_count', v_prev.car_count::text, p_car_count::text)
    ) as f(field, prev, new_v)
    where coalesce(f.prev,'~') <> coalesce(f.new_v,'~');
  end if;

  update public.metric_snapshots set is_current = true where id = v_new_id;
  return v_new_id;
end $$;
revoke all on function public._save_metric_snapshot(uuid,date,public.report_scope,numeric,integer,integer,public.metric_source,uuid,text,jsonb,text) from public, anon, authenticated;
create or replace function public.save_metric_snapshot(
  p_shop_id uuid, p_business_date date, p_scope public.report_scope,
  p_gross_profit numeric, p_tires_sold integer, p_car_count integer,
  p_source public.metric_source, p_import_id uuid, p_note text, p_flags jsonb,
  p_correction_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_prev public.metric_snapshots;
  v_new_id uuid;
begin
  if v_user is null or not public.has_shop_permission(p_shop_id, 'edit_dashboard_numbers') then
    raise exception 'Not authorized for this shop';
  end if;

  select * into v_prev from public.metric_snapshots
  where shop_id = p_shop_id and business_date = p_business_date and scope = p_scope and is_current
  for update;

  insert into public.metric_snapshots (shop_id, business_date, scope, gross_profit, tires_sold,
    car_count, source, import_id, entered_by, note, flags, is_current)
  values (p_shop_id, p_business_date, p_scope, p_gross_profit, p_tires_sold, p_car_count,
    p_source, p_import_id, v_user, p_note, coalesce(p_flags, '[]'::jsonb), false)
  returning id into v_new_id;

  if v_prev.id is not null then
    update public.metric_snapshots
      set is_current = false, superseded_at = now(), superseded_by = v_new_id
      where id = v_prev.id;

    insert into public.metric_corrections (shop_id, business_date, scope, field, previous_value,
      new_value, previous_snapshot_id, new_snapshot_id, corrected_by, note)
    select p_shop_id, p_business_date, p_scope, f.field, f.prev, f.new_v, v_prev.id, v_new_id, v_user, p_correction_note
    from (
      values
        ('gross_profit', v_prev.gross_profit::text, p_gross_profit::text),
        ('tires_sold', v_prev.tires_sold::text, p_tires_sold::text),
        ('car_count', v_prev.car_count::text, p_car_count::text)
    ) as f(field, prev, new_v)
    where coalesce(f.prev,'~') <> coalesce(f.new_v,'~');
  end if;

  update public.metric_snapshots set is_current = true where id = v_new_id;
  return v_new_id;
end $$;

create or replace function public.accept_import_metrics(
  p_import_id uuid, p_rows jsonb, p_note text default null
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_imp public.imports;
  v_row jsonb;
  v_count integer := 0;
begin
  select * into v_imp from public.imports where id = p_import_id for update;
  if v_imp.id is null then raise exception 'Import not found'; end if;
  if v_user is null or not public.has_shop_permission(v_imp.shop_id, 'approve_imports') then
    raise exception 'Not authorized for this shop';
  end if;
  if v_imp.status = 'accepted' then raise exception 'Import already accepted'; end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    perform public._save_metric_snapshot(
      v_imp.shop_id,
      (v_row->>'business_date')::date,
      (v_row->>'scope')::public.report_scope,
      nullif(v_row->>'gross_profit','')::numeric,
      nullif(v_row->>'tires_sold','')::integer,
      nullif(v_row->>'car_count','')::integer,
      'import'::public.metric_source,
      p_import_id,
      p_note,
      coalesce(v_row->'flags', '[]'::jsonb),
      'Accepted from import ' || v_imp.file_name
    );
    v_count := v_count + 1;
  end loop;

  update public.imports
    set status = 'accepted', reviewed_by = v_user, reviewed_at = now()
    where id = p_import_id;

  return v_count;
end $$;

CREATE OR REPLACE FUNCTION public.accept_import_records(
  p_import_id uuid,
  p_kind text,
  p_snapshot_date date,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user uuid := auth.uid();
  v_imp public.imports;
  v_row jsonb;
  v_saved integer := 0;
  v_review integer := 0;
  v_prev public.shop_jobs;
  v_new_id uuid;
  v_kind text;
  v_customer_id uuid;
  v_flags jsonb;
begin
  if v_user is null then
    raise exception 'Sign in required';
  end if;
  if p_kind not in ('inventory', 'jobs', 'appointments', 'customers') then
    raise exception 'Unknown record type';
  end if;

  select * into v_imp from public.imports where id = p_import_id for update;
  if v_imp.id is null then
    raise exception 'Import not found';
  end if;
  if not public.has_shop_permission(v_imp.shop_id, 'approve_imports') then
    raise exception 'Not authorized for this shop';
  end if;
  if v_imp.status = 'accepted'::public.import_status then
    raise exception 'This import has already been accepted';
  end if;
  if v_imp.status = 'rejected'::public.import_status then
    raise exception 'This import was rejected and cannot be accepted';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_flags := coalesce(v_row->'flags', '[]'::jsonb);

    if p_kind = 'inventory' then
      insert into public.inventory_items (
        shop_id, import_id, snapshot_date, identity_key, external_id, description,
        brand, size, quantity, price, cost, flags, needs_review)
      values (
        v_imp.shop_id, p_import_id, p_snapshot_date,
        v_row->>'identity_key',
        nullif(v_row->>'external_id',''),
        coalesce(nullif(v_row->>'description',''), 'Unlabelled item'),
        nullif(v_row->>'brand',''),
        nullif(v_row->>'size',''),
        nullif(v_row->>'quantity','')::integer,
        nullif(v_row->>'price','')::numeric,
        nullif(v_row->>'cost','')::numeric,
        v_flags,
        coalesce((v_row->>'needs_review')::boolean, false))
      on conflict (shop_id, snapshot_date, identity_key) do update
        set description = excluded.description,
            brand = excluded.brand,
            size = excluded.size,
            quantity = excluded.quantity,
            price = excluded.price,
            cost = excluded.cost,
            flags = excluded.flags,
            needs_review = excluded.needs_review,
            import_id = excluded.import_id;
      v_saved := v_saved + 1;

    elsif p_kind = 'customers' then
      insert into public.customers (
        shop_id, import_id, identity_key, external_id, name, phone, email, flags, needs_review)
      values (
        v_imp.shop_id, p_import_id,
        v_row->>'identity_key',
        nullif(v_row->>'external_id',''),
        coalesce(nullif(v_row->>'name',''), 'Name not recorded'),
        nullif(v_row->>'phone',''),
        nullif(v_row->>'email',''),
        v_flags,
        coalesce((v_row->>'needs_review')::boolean, false))
      on conflict (shop_id, identity_key) do update
        set name = excluded.name,
            phone = coalesce(excluded.phone, customers.phone),
            email = coalesce(excluded.email, customers.email),
            flags = excluded.flags,
            needs_review = excluded.needs_review
      returning id into v_customer_id;

      v_saved := v_saved + 1;

      if v_customer_id is not null and coalesce(v_row->>'vehicle_identity_key','') <> '' then
        insert into public.vehicles (
          shop_id, customer_id, identity_key, external_id, year, make, model, vin, plate, needs_review)
        values (
          v_imp.shop_id, v_customer_id,
          v_row->>'vehicle_identity_key',
          nullif(v_row->>'vehicle_external_id',''),
          nullif(v_row->>'year',''),
          nullif(v_row->>'make',''),
          nullif(v_row->>'model',''),
          nullif(v_row->>'vin',''),
          nullif(v_row->>'plate',''),
          coalesce((v_row->>'needs_review')::boolean, false))
        on conflict (shop_id, identity_key) do update
          set customer_id = excluded.customer_id,
              year = coalesce(excluded.year, vehicles.year),
              make = coalesce(excluded.make, vehicles.make),
              model = coalesce(excluded.model, vehicles.model),
              vin = coalesce(excluded.vin, vehicles.vin),
              plate = coalesce(excluded.plate, vehicles.plate),
              needs_review = excluded.needs_review;
      end if;

    else
      v_kind := case when p_kind = 'appointments' then 'appointment' else 'job' end;

      select * into v_prev from public.shop_jobs
        where shop_id = v_imp.shop_id
          and record_kind = v_kind
          and identity_key = v_row->>'identity_key'
          and is_current
        for update;

      -- A new snapshot row is inserted; the prior snapshot is retained as history
      -- and any staff note / in-app status is carried forward.
      insert into public.shop_jobs (
        shop_id, import_id, record_kind, identity_key, external_id, customer_name,
        vehicle_label, requested_service, technician, arrival_at, appointment_at,
        disposition, job_status, snapshot_at, is_current, flags, needs_review,
        local_status, local_note, local_updated_by, local_updated_at)
      values (
        v_imp.shop_id, p_import_id, v_kind,
        v_row->>'identity_key',
        nullif(v_row->>'external_id',''),
        nullif(v_row->>'customer_name',''),
        nullif(v_row->>'vehicle_label',''),
        nullif(v_row->>'requested_service',''),
        nullif(v_row->>'technician',''),
        nullif(v_row->>'arrival_at','')::timestamptz,
        nullif(v_row->>'appointment_at','')::timestamptz,
        nullif(v_row->>'disposition',''),
        nullif(v_row->>'job_status',''),
        now(), false,
        v_flags,
        coalesce((v_row->>'needs_review')::boolean, false),
        v_prev.local_status, v_prev.local_note, v_prev.local_updated_by, v_prev.local_updated_at)
      returning id into v_new_id;

      if v_prev.id is not null then
        update public.shop_jobs
          set is_current = false, superseded_at = now(), superseded_by = v_new_id
          where id = v_prev.id;
      end if;

      update public.shop_jobs set is_current = true where id = v_new_id;
      v_saved := v_saved + 1;
    end if;

    if coalesce((v_row->>'needs_review')::boolean, false) then
      v_review := v_review + 1;
    end if;
  end loop;

  update public.imports
    set status = 'accepted'::public.import_status,
        reviewed_by = v_user,
        reviewed_at = now()
    where id = p_import_id;

  return jsonb_build_object('saved', v_saved, 'needs_review', v_review);
end $$;
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
   where m.user_id = v_user and m.status = 'approved' and public.has_shop_permission(m.shop_id, 'manage_staff') limit 1;
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
