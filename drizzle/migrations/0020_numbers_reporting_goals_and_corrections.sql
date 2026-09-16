-- Numbers & performance reporting: sales metric, goal rules, period-level productivity.
ALTER TABLE public.metric_snapshots ADD COLUMN IF NOT EXISTS sales numeric;
ALTER TABLE public.shop_settings ADD COLUMN IF NOT EXISTS goal_rules jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.technician_productivity ADD COLUMN IF NOT EXISTS period_scope text;

-- Same guarded, history-preserving save as save_metric_snapshot, extended with sales.
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
  if v_user is null or not public.has_shop_access(p_shop_id, v_user) then
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

-- Period-level technician productivity correction with correction history.
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
  if v_user is null or not public.has_shop_access(p_shop_id, v_user) then
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

REVOKE ALL ON FUNCTION public.save_shop_metrics(uuid, date, report_scope, numeric, numeric, integer, integer, metric_source, uuid, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_period_productivity(uuid, date, text, numeric, text, report_scope, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_shop_metrics(uuid, date, report_scope, numeric, numeric, integer, integer, metric_source, uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_period_productivity(uuid, date, text, numeric, text, report_scope, text) TO authenticated;