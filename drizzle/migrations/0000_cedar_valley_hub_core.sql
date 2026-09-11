-- ENUMS
create type public.member_role as enum ('owner','manager','staff');
create type public.member_status as enum ('pending','approved','revoked');
create type public.report_scope as enum ('daily','mtd','ytd','invoice','inventory','jobs','other');
create type public.import_status as enum ('uploaded','extracting','extracted','failed','accepted','rejected');
create type public.metric_source as enum ('manual','import','api');

-- SHOPS
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Chicago',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.shops to authenticated;
grant all on public.shops to service_role;
alter table public.shops enable row level security;

-- PROFILES
create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile write" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- MEMBERSHIP
create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null,
  email text,
  role public.member_role not null default 'staff',
  status public.member_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (shop_id, user_id)
);
grant select, insert, update on public.shop_members to authenticated;
grant all on public.shop_members to service_role;
alter table public.shop_members enable row level security;

create or replace function public.has_shop_access(_shop_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_members m
    where m.shop_id = _shop_id and m.user_id = _user_id and m.status = 'approved');
$$;

create or replace function public.is_shop_owner(_shop_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_members m
    where m.shop_id = _shop_id and m.user_id = _user_id and m.status = 'approved' and m.role = 'owner');
$$;

create or replace function public.is_owner_email()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', auth.jwt() ->> 'email', '')) = 'codysseus2390@gmail.com';
$$;

create policy "members read own shop" on public.shops for select to authenticated
  using (public.has_shop_access(id));
create policy "only owner email creates shop" on public.shops for insert to authenticated
  with check (public.is_owner_email() and created_by = auth.uid());
create policy "owner updates shop" on public.shops for update to authenticated
  using (public.is_shop_owner(id));

create policy "read memberships of my shop" on public.shop_members for select to authenticated
  using (user_id = auth.uid() or public.has_shop_access(shop_id));
create policy "request own membership" on public.shop_members for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "owner decides membership" on public.shop_members for update to authenticated
  using (public.is_shop_owner(shop_id));

-- IMPORTS
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  uploaded_by uuid not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_hash text not null,
  file_size integer,
  report_scope public.report_scope not null default 'other',
  period_start date,
  period_end date,
  captured_at timestamptz,
  status public.import_status not null default 'uploaded',
  extraction jsonb,
  extraction_notes text,
  error_message text,
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  unique (shop_id, file_hash)
);
create index imports_shop_date_idx on public.imports (shop_id, uploaded_at desc);
grant select, insert, update on public.imports to authenticated;
grant all on public.imports to service_role;
alter table public.imports enable row level security;
create policy "shop members read imports" on public.imports for select to authenticated
  using (public.has_shop_access(shop_id));
create policy "shop members create imports" on public.imports for insert to authenticated
  with check (public.has_shop_access(shop_id) and uploaded_by = auth.uid());
create policy "shop members update imports" on public.imports for update to authenticated
  using (public.has_shop_access(shop_id));

-- METRIC SNAPSHOTS
create table public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  business_date date not null,
  scope public.report_scope not null default 'daily',
  gross_profit numeric(12,2),
  tires_sold integer,
  car_count integer,
  source public.metric_source not null default 'manual',
  import_id uuid references public.imports(id) on delete set null,
  entered_by uuid not null,
  note text,
  flags jsonb not null default '[]'::jsonb,
  is_current boolean not null default true,
  superseded_at timestamptz,
  superseded_by uuid,
  created_at timestamptz not null default now()
);
create unique index metric_current_unique on public.metric_snapshots (shop_id, business_date, scope) where is_current;
create index metric_shop_date_idx on public.metric_snapshots (shop_id, business_date desc);
grant select, insert, update on public.metric_snapshots to authenticated;
grant all on public.metric_snapshots to service_role;
alter table public.metric_snapshots enable row level security;
create policy "shop members read metrics" on public.metric_snapshots for select to authenticated
  using (public.has_shop_access(shop_id));

-- CORRECTIONS AUDIT
create table public.metric_corrections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  business_date date not null,
  scope public.report_scope not null,
  field text not null,
  previous_value text,
  new_value text,
  previous_snapshot_id uuid,
  new_snapshot_id uuid,
  corrected_by uuid not null,
  corrected_at timestamptz not null default now(),
  note text
);
grant select on public.metric_corrections to authenticated;
grant all on public.metric_corrections to service_role;
alter table public.metric_corrections enable row level security;
create policy "shop members read corrections" on public.metric_corrections for select to authenticated
  using (public.has_shop_access(shop_id));

-- ATOMIC SAVE
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
revoke all on function public.save_metric_snapshot(uuid, date, public.report_scope, numeric, integer, integer, public.metric_source, uuid, text, jsonb, text) from public;
grant execute on function public.save_metric_snapshot(uuid, date, public.report_scope, numeric, integer, integer, public.metric_source, uuid, text, jsonb, text) to authenticated, service_role;

-- INVENTORY SNAPSHOTS
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  external_id text,
  description text not null,
  brand text,
  size text,
  quantity integer,
  price numeric(12,2),
  cost numeric(12,2),
  snapshot_date date not null,
  import_id uuid references public.imports(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (shop_id, snapshot_date, external_id, description)
);
grant select, insert on public.inventory_items to authenticated;
grant all on public.inventory_items to service_role;
alter table public.inventory_items enable row level security;
create policy "shop members read inventory" on public.inventory_items for select to authenticated
  using (public.has_shop_access(shop_id));
create policy "shop members write inventory" on public.inventory_items for insert to authenticated
  with check (public.has_shop_access(shop_id));

-- CUSTOMERS / VEHICLES
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  external_id text,
  name text not null,
  phone text,
  email text,
  first_seen_at timestamptz not null default now(),
  import_id uuid references public.imports(id) on delete set null,
  unique (shop_id, external_id)
);
grant select, insert, update on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "shop members read customers" on public.customers for select to authenticated
  using (public.has_shop_access(shop_id));
create policy "shop members write customers" on public.customers for insert to authenticated
  with check (public.has_shop_access(shop_id));

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  external_id text,
  year text, make text, model text, vin text, plate text,
  created_at timestamptz not null default now(),
  unique (shop_id, external_id)
);
grant select, insert, update on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "shop members read vehicles" on public.vehicles for select to authenticated
  using (public.has_shop_access(shop_id));
create policy "shop members write vehicles" on public.vehicles for insert to authenticated
  with check (public.has_shop_access(shop_id));

-- JOBS / APPOINTMENTS (read-only imported records)
create table public.shop_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  external_id text,
  record_kind text not null default 'job',
  customer_name text,
  vehicle_label text,
  requested_service text,
  technician text,
  arrival_at timestamptz,
  appointment_at timestamptz,
  disposition text,
  job_status text,
  snapshot_at timestamptz not null default now(),
  import_id uuid references public.imports(id) on delete set null,
  local_status text,
  local_note text,
  local_updated_by uuid,
  local_updated_at timestamptz,
  is_current boolean not null default true
);
create unique index jobs_external_unique on public.shop_jobs (shop_id, record_kind, external_id) where external_id is not null;
grant select, insert, update on public.shop_jobs to authenticated;
grant all on public.shop_jobs to service_role;
alter table public.shop_jobs enable row level security;
create policy "shop members read jobs" on public.shop_jobs for select to authenticated
  using (public.has_shop_access(shop_id));
create policy "shop members write jobs" on public.shop_jobs for insert to authenticated
  with check (public.has_shop_access(shop_id));
create policy "shop members update jobs" on public.shop_jobs for update to authenticated
  using (public.has_shop_access(shop_id));

-- ASSISTANT LOG
create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.assistant_messages to authenticated;
grant all on public.assistant_messages to service_role;
alter table public.assistant_messages enable row level security;
create policy "own assistant messages" on public.assistant_messages for select to authenticated
  using (user_id = auth.uid() and public.has_shop_access(shop_id));
create policy "insert own assistant messages" on public.assistant_messages for insert to authenticated
  with check (user_id = auth.uid() and public.has_shop_access(shop_id));

-- ATOMIC IMPORT ACCEPT
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
  if v_user is null or not public.has_shop_access(v_imp.shop_id, v_user) then
    raise exception 'Not authorized for this shop';
  end if;
  if v_imp.status = 'accepted' then raise exception 'Import already accepted'; end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    perform public.save_metric_snapshot(
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
revoke all on function public.accept_import_metrics(uuid, jsonb, text) from public;
grant execute on function public.accept_import_metrics(uuid, jsonb, text) to authenticated, service_role;