alter table public.shop_settings add column business_calendar jsonb;

-- Only the two verified Cedar shops receive the owner's confirmed weekday rule.
-- Other shops must configure their own calendar. No holidays are inferred.
insert into public.shop_settings(shop_id, business_calendar)
select s.id, jsonb_build_object(
  'schedules', jsonb_build_array(jsonb_build_object('effective_from',
    least(date_trunc('year', coalesce((select min(business_date) from public.metric_snapshots m where m.shop_id=s.id), current_date))::date,
      (date_trunc('year',current_date) - interval '1 year')::date)::text,
    'open_weekdays', jsonb_build_array(1,2,3,4,5))), 'exceptions', '[]'::jsonb)
from public.shops s where s.id in (
  '7abf0d1f-1faf-488a-b356-ce635e278bc2'::uuid,
  '8d1b6141-6f8a-441e-9725-f2d8358e62c5'::uuid)
on conflict(shop_id) do update set business_calendar = excluded.business_calendar
where shop_settings.business_calendar is null;

-- `v_retroactive`/`v_retroactive_from` are transaction-local settings that
-- save_business_calendar() below sets immediately before writing, so the trigger
-- can mark a confirmed retroactive reinterpretation of past open/closed status
-- distinctly from an ordinary forward-dated edit. App-level guard: saveBusinessCalendar
-- in src/lib/admin.functions.ts computes earliestRetroactiveStatusChange() (in
-- src/lib/business-calendar.ts) and refuses to call save_business_calendar with
-- p_retroactive unset when a date on/before the shop's local today would change
-- status; it only proceeds once the caller sends an explicit confirmRetroactive flag.
create function public.guard_business_calendar() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  v_retroactive boolean := coalesce(nullif(current_setting('app.calendar_retroactive', true), ''), 'false')::boolean;
  v_retroactive_from text := nullif(current_setting('app.calendar_retroactive_from', true), '');
begin
  if (tg_op = 'INSERT' and new.business_calendar is not null)
     or (tg_op = 'UPDATE' and new.business_calendar is distinct from old.business_calendar) then
    if not public.is_shop_owner(new.shop_id) then raise exception 'Only the owner can change the business calendar'; end if;
    insert into public.audit_events(shop_id,actor_id,action,target,detail)
    values(new.shop_id,auth.uid(),
      case when v_retroactive then 'business_calendar_changed_retroactive' else 'business_calendar_changed' end,
      'shop_settings',
      jsonb_build_object(
        'previous',case when tg_op='UPDATE' then old.business_calendar else null end,
        'next',new.business_calendar,
        'retroactive', v_retroactive,
        'retroactive_from', v_retroactive_from));
  end if;
  return new;
end $$;
revoke all on function public.guard_business_calendar() from public,anon,authenticated;
create trigger business_calendar_guard before insert or update on public.shop_settings
for each row execute function public.guard_business_calendar();

-- Single-call, guarded write path. PostgREST issues one statement per request, so
-- the retroactive marking above must be set inside the same function call as the
-- insert/update that fires the trigger — a separate `set_config` request would not
-- reliably share a transaction/connection with a following upsert request.
create function public.save_business_calendar(
  p_shop_id uuid,
  p_business_calendar jsonb,
  p_retroactive boolean default false,
  p_retroactive_from date default null
) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_shop_owner(p_shop_id) then
    raise exception 'Only the owner can change the business calendar';
  end if;
  perform set_config('app.calendar_retroactive', p_retroactive::text, true);
  perform set_config('app.calendar_retroactive_from', coalesce(p_retroactive_from::text, ''), true);
  insert into public.shop_settings(shop_id, business_calendar, updated_by, updated_at)
  values (p_shop_id, p_business_calendar, auth.uid(), now())
  on conflict (shop_id) do update
    set business_calendar = excluded.business_calendar,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end $$;
revoke all on function public.save_business_calendar(uuid,jsonb,boolean,date) from public,anon,authenticated;
grant execute on function public.save_business_calendar(uuid,jsonb,boolean,date) to authenticated;
