-- Archive announcements without losing history, and allow explicit permanent history deletion.
alter table public.notifications
  add column if not exists archived_at timestamptz;

grant update (archived_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

create policy manage_announcement_archives on public.notifications
  for update to authenticated
  using (public.is_shop_manager(shop_id) and audience in ('all', 'display', 'all_display'))
  with check (public.is_shop_manager(shop_id) and audience in ('all', 'display', 'all_display'));

create policy manage_announcement_history_deletes on public.notifications
  for delete to authenticated
  using (public.is_shop_manager(shop_id) and audience in ('all', 'display', 'all_display'));
