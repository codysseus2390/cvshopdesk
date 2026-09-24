-- Allow managers to edit TV announcements and remove a TV delivery.
-- The notification and any employee recipients remain in history.
grant update (title, message, priority) on public.notifications to authenticated;
grant delete on public.notification_recipients to authenticated;

create policy manage_tv_notification_edits on public.notifications
  for update to authenticated
  using (
    public.is_shop_manager(shop_id)
    and exists (
      select 1 from public.notification_recipients r
      where r.notification_id = notifications.id
        and r.shop_id = notifications.shop_id and r.target = 'display'
    )
  )
  with check (
    public.is_shop_manager(shop_id)
    and exists (
      select 1 from public.notification_recipients r
      where r.notification_id = notifications.id
        and r.shop_id = notifications.shop_id and r.target = 'display'
    )
  );

create policy manage_tv_recipient_removal on public.notification_recipients
  for delete to authenticated
  using (
    target = 'display'
    and public.is_shop_manager(shop_id)
    and exists (
      select 1 from public.notifications n
      where n.id = notification_id and n.shop_id = notification_recipients.shop_id
    )
  );
