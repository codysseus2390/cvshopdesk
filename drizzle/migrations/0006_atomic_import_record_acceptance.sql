-- Durable identity + review flags for imported rows -------------------------

ALTER TABLE public.shop_jobs
  ADD COLUMN IF NOT EXISTS identity_key text,
  ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

UPDATE public.shop_jobs
  SET identity_key = coalesce(external_id, 'row:' || id::text)
  WHERE identity_key IS NULL;

DROP INDEX IF EXISTS public.jobs_external_unique;
CREATE UNIQUE INDEX IF NOT EXISTS shop_jobs_current_identity
  ON public.shop_jobs (shop_id, record_kind, identity_key)
  WHERE is_current;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS identity_key text,
  ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

UPDATE public.inventory_items
  SET identity_key = coalesce(external_id, 'row:' || id::text)
  WHERE identity_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_snapshot_identity
  ON public.inventory_items (shop_id, snapshot_date, identity_key);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS identity_key text,
  ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

UPDATE public.customers
  SET identity_key = coalesce(external_id, 'row:' || id::text)
  WHERE identity_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_identity
  ON public.customers (shop_id, identity_key);

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS identity_key text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

UPDATE public.vehicles
  SET identity_key = coalesce(external_id, 'row:' || id::text)
  WHERE identity_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_shop_identity
  ON public.vehicles (shop_id, identity_key);

-- An accepted import can never be reopened, re-accepted or rejected ---------

CREATE OR REPLACE FUNCTION public.guard_import_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if old.status = 'accepted'::public.import_status then
    if new.status <> 'accepted'::public.import_status then
      raise exception 'An accepted import cannot be reopened or rejected';
    end if;
    if new.reviewed_at is distinct from old.reviewed_at
       or new.extraction is distinct from old.extraction then
      raise exception 'This import has already been accepted';
    end if;
  end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS imports_status_guard ON public.imports;
CREATE TRIGGER imports_status_guard
  BEFORE UPDATE ON public.imports
  FOR EACH ROW EXECUTE FUNCTION public.guard_import_status();

-- Atomic reviewed acceptance of imported records ----------------------------

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
  if not public.has_shop_access(v_imp.shop_id, v_user) then
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

REVOKE ALL ON FUNCTION public.accept_import_records(uuid, text, date, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_import_records(uuid, text, date, jsonb) TO authenticated;