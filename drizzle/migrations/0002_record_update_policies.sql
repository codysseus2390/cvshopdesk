-- Imported record snapshots are refreshed in place (upsert), so members need UPDATE
-- on the record tables. Metric snapshots stay insert-only through the RPCs.
grant update on public.inventory_items to authenticated;
grant update on public.customers to authenticated;
grant update on public.vehicles to authenticated;

create policy "shop members update inventory" on public.inventory_items for update to authenticated
  using (public.has_shop_access(shop_id)) with check (public.has_shop_access(shop_id));
create policy "shop members update customers" on public.customers for update to authenticated
  using (public.has_shop_access(shop_id)) with check (public.has_shop_access(shop_id));
create policy "shop members update vehicles" on public.vehicles for update to authenticated
  using (public.has_shop_access(shop_id)) with check (public.has_shop_access(shop_id));