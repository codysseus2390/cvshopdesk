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

create function public.guard_business_calendar() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if (tg_op = 'INSERT' and new.business_calendar is not null)
     or (tg_op = 'UPDATE' and new.business_calendar is distinct from old.business_calendar) then
    if not public.is_shop_owner(new.shop_id) then raise exception 'Only the owner can change the business calendar'; end if;
    insert into public.audit_events(shop_id,actor_id,action,target,detail)
    values(new.shop_id,auth.uid(),'business_calendar_changed','shop_settings',
      jsonb_build_object('previous',case when tg_op='UPDATE' then old.business_calendar else null end,'next',new.business_calendar));
  end if;
  return new;
end $$;
revoke all on function public.guard_business_calendar() from public,anon,authenticated;
create trigger business_calendar_guard before insert or update on public.shop_settings
for each row execute function public.guard_business_calendar();
