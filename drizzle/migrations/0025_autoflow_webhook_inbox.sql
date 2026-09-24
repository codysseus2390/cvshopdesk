-- Custom SQL migration file, put your code below! --
-- DRAFT: apply only after environment review. This inbox never updates shop_jobs.
CREATE TABLE public.autoflow_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  autoflow_shop_id text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type = 'status_update'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'pending_review'
    CHECK (processing_status IN ('pending_review', 'processed', 'rejected')),
  UNIQUE (shop_id, autoflow_shop_id, event_type, event_id)
);
ALTER TABLE public.autoflow_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.autoflow_webhook_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.autoflow_webhook_events TO service_role;
COMMENT ON TABLE public.autoflow_webhook_events IS
  'Private untrusted Autoflow inbox. Provider hash covers event ID only. No automatic job updates.';
