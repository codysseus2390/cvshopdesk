REVOKE ALL ON FUNCTION public.accept_import_records(uuid, text, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_import_records(uuid, text, date, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_import_records(uuid, text, date, jsonb) TO authenticated, service_role;