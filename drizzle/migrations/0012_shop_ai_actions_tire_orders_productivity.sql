-- Tire orders, technician productivity and the AI action audit log.

create table if not exists public.tire_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  phone text,
  vehicle_label text,
  brand text,
  model text,
  size text,
  quantity integer not null default 4,
  price_each numeric,
  vendor text,
  status text not null default 'ordered' check (status in ('draft','ordered','received','installed','cancelled')),
  notes text,
  external_ref text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  received_at timestamptz
);

grant select, insert, update, delete on public.tire_orders to authenticated;
grant all on public.tire_orders to service_role;
alter table public.tire_orders enable row level security;

create policy "shop members read tire orders" on public.tire_orders
  for select to authenticated using (public.has_shop_access(shop_id));
create policy "shop members create tire orders" on public.tire_orders
  for insert to authenticated with check (public.has_shop_access(shop_id));
create policy "shop members update tire orders" on public.tire_orders
  for update to authenticated using (public.has_shop_access(shop_id))
  with check (public.has_shop_access(shop_id));
create policy "managers delete tire orders" on public.tire_orders
  for delete to authenticated using (public.is_shop_manager(shop_id));

create index if not exists tire_orders_shop_status_idx on public.tire_orders (shop_id, status, created_at desc);

create table if not exists public.technician_productivity (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  business_date date not null,
  technician text not null,
  productivity_pct numeric,
  hours_billed numeric,
  hours_worked numeric,
  cars integer,
  note text,
  entered_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, business_date, technician)
);

grant select, insert, update, delete on public.technician_productivity to authenticated;
grant all on public.technician_productivity to service_role;
alter table public.technician_productivity enable row level security;

create policy "shop members read productivity" on public.technician_productivity
  for select to authenticated using (public.has_shop_access(shop_id));
create policy "shop members create productivity" on public.technician_productivity
  for insert to authenticated with check (public.has_shop_access(shop_id));
create policy "shop members update productivity" on public.technician_productivity
  for update to authenticated using (public.has_shop_access(shop_id))
  with check (public.has_shop_access(shop_id));

-- Every AI-initiated action is recorded here, including blocked and failed attempts.
create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null,
  tool text not null,
  status text not null check (status in ('executed','confirmation_requested','blocked','failed')),
  confirmation_required boolean not null default false,
  confirmed boolean not null default false,
  target_table text,
  target_id text,
  args jsonb not null default '{}'::jsonb,
  before_values jsonb,
  after_values jsonb,
  error text,
  created_at timestamptz not null default now()
);

grant select, insert on public.ai_actions to authenticated;
grant all on public.ai_actions to service_role;
alter table public.ai_actions enable row level security;

create policy "shop members read ai actions" on public.ai_actions
  for select to authenticated using (public.has_shop_access(shop_id));
create policy "shop members write own ai actions" on public.ai_actions
  for insert to authenticated
  with check (public.has_shop_access(shop_id) and user_id = auth.uid());

create index if not exists ai_actions_shop_created_idx on public.ai_actions (shop_id, created_at desc);
