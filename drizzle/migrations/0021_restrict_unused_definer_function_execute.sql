-- Remove signed-in EXECUTE from the superseded SECURITY DEFINER helper.
-- It is only called internally by accept_import_metrics (also SECURITY DEFINER),
-- so revoking direct client access does not break any app path.
REVOKE ALL ON FUNCTION public.save_metric_snapshot(uuid, date, report_scope, numeric, integer, integer, metric_source, uuid, text, jsonb, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.save_metric_snapshot(uuid, date, report_scope, numeric, integer, integer, metric_source, uuid, text, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.save_metric_snapshot(uuid, date, report_scope, numeric, integer, integer, metric_source, uuid, text, jsonb, text) FROM PUBLIC;
