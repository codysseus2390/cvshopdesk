-- Managers can change the message shown on the TV and remove its display recipient.
-- Removing the display recipient preserves the notification and any employee recipients.
grant update (title, message, priority) on public.notifications to authenticated;
grant delete on public.notification_recipients to authenticated;

create policy manage_tv_notification_edits on public.notifications
  for update to authenticated
  using (
    public.has_shop_permission(shop_id, 'manage_notifications')
    and exists (
      select 1 from public.notification_recipients r
      where r.notification_id = notifications.id
        and r.shop_id = notifications.shop_id and r.target = 'display'
    )
  )
  with check (
    public.has_shop_permission(shop_id, 'manage_notifications')
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
    and public.has_shop_permission(shop_id, 'manage_notifications')
    and exists (
      select 1 from public.notifications n
      where n.id = notification_id and n.shop_id = notification_recipients.shop_id
    )
  );
