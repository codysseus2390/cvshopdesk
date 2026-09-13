-- Remove unnecessary EXECUTE grants on SECURITY DEFINER functions.

-- Trigger-only functions: never called directly by API roles.
revoke all on function public.enforce_member_role() from public, anon, authenticated;
revoke all on function public.guard_import_status() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- RPCs: signed-in staff only, never anonymous.
revoke all on function public.accept_import_metrics(uuid, jsonb, text) from public, anon;
grant execute on function public.accept_import_metrics(uuid, jsonb, text) to authenticated;

revoke all on function public.save_metric_snapshot(uuid, date, report_scope, numeric, integer, integer, metric_source, uuid, text, jsonb, text) from public, anon;
grant execute on function public.save_metric_snapshot(uuid, date, report_scope, numeric, integer, integer, metric_source, uuid, text, jsonb, text) to authenticated;

revoke all on function public.accept_import_records(uuid, text, date, jsonb) from public, anon;
grant execute on function public.accept_import_records(uuid, text, date, jsonb) to authenticated;
revoke all on function public.add_staff_member(text, member_role) from public, anon;
grant execute on function public.add_staff_member(text, member_role) to authenticated;
revoke all on function public.bootstrap_shop(text, text) from public, anon;
grant execute on function public.bootstrap_shop(text, text) to authenticated;
revoke all on function public.log_audit_event(text, text, jsonb) from public, anon;
grant execute on function public.log_audit_event(text, text, jsonb) to authenticated;
revoke all on function public.request_shop_access() from public, anon;
grant execute on function public.request_shop_access() to authenticated;

-- Row-level-security helper predicates: needed by policies evaluated as the
-- signed-in user, but not reachable anonymously.
revoke all on function public.has_shop_access(uuid, uuid) from public, anon;
grant execute on function public.has_shop_access(uuid, uuid) to authenticated;
revoke all on function public.is_shop_manager(uuid, uuid) from public, anon;
grant execute on function public.is_shop_manager(uuid, uuid) to authenticated;
revoke all on function public.is_shop_owner(uuid, uuid) from public, anon;
grant execute on function public.is_shop_owner(uuid, uuid) to authenticated;
revoke all on function public.is_owner_email() from public, anon;
grant execute on function public.is_owner_email() to authenticated;