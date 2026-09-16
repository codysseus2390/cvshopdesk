-- 1) History tables: deletion is intentionally not allowed for staff. Make the
-- denial explicit at the privilege level instead of relying only on absent policies.
revoke delete on public.customers from authenticated, anon;
revoke delete on public.vehicles from authenticated, anon;
revoke delete on public.inventory_items from authenticated, anon;
revoke delete on public.shop_jobs from authenticated, anon;
revoke delete on public.metric_snapshots from authenticated, anon;
revoke delete on public.ai_actions from authenticated, anon;
revoke delete on public.imports from authenticated, anon;
revoke delete on public.audit_events from authenticated, anon;
revoke delete on public.metric_corrections from authenticated, anon;
revoke delete on public.assistant_messages from authenticated, anon;

-- 2) Private shop-uploads bucket: explicit ownership-checked manage policies so
-- file changes/removal are only possible for managers of the owning shop.
drop policy if exists "shop managers update uploads" on storage.objects;
create policy "shop managers update uploads"
on storage.objects for update to authenticated
using (
  bucket_id = 'shop-uploads'
  and public.is_shop_manager(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'shop-uploads'
  and public.is_shop_manager(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "shop managers delete uploads" on storage.objects;
create policy "shop managers delete uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'shop-uploads'
  and public.is_shop_manager(((storage.foldername(name))[1])::uuid)
);

-- 3) SECURITY DEFINER functions: no anonymous or PUBLIC execution. Signed-in
-- staff keep only the calls that validate membership internally; helper
-- predicates used by RLS remain callable because policies run as the caller.
revoke all on function public.accept_import_metrics(uuid, jsonb, text) from public, anon;
revoke all on function public.accept_import_records(uuid, text, date, jsonb) from public, anon;
revoke all on function public.add_staff_member(text, public.member_role) from public, anon;
revoke all on function public.bootstrap_shop(text, text) from public, anon;
revoke all on function public.log_audit_event(text, text, jsonb) from public, anon;
revoke all on function public.request_shop_access() from public, anon;
revoke all on function public.save_metric_snapshot(uuid, date, public.report_scope, numeric, integer, integer, public.metric_source, uuid, text, jsonb, text) from public, anon;
revoke all on function public.is_owner_email() from public, anon;
