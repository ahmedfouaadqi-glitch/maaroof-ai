ALTER TABLE public.brand_boost_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.brand_boost_runs ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.brand_authority_packs ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.crawler_hits ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS public.brand_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  operation_type text NOT NULL, brand_name text NULL, status text NOT NULL DEFAULT 'completed',
  request_meta jsonb NOT NULL DEFAULT '{}'::jsonb, result_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz NOT NULL DEFAULT now(),
  duration_ms bigint NULL, charged_units numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.brand_operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.brand_operations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.crawler_hits
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'user_agent_only',
  ADD COLUMN IF NOT EXISTS verified_hostname text NULL,
  ADD COLUMN IF NOT EXISTS verification_method text NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL;
CREATE TABLE IF NOT EXISTS public.crawler_ip_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ip_hash text NOT NULL, bot_name text NOT NULL,
  verification_status text NOT NULL, verified_hostname text NULL,
  verification_method text NOT NULL DEFAULT 'ptr_forward_confirm',
  checked_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, UNIQUE (ip_hash, bot_name));
CREATE TABLE IF NOT EXISTS public.brand_boost_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_to text NOT NULL, enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.brand_boost_report_settings
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_code_hash text NULL,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.brand_boost_report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), delivery_key text NOT NULL UNIQUE, user_id uuid NOT NULL,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_month text NOT NULL, email_to text NOT NULL, status text NOT NULL DEFAULT 'pending',
  provider_message_id text NULL, error_message text NULL, attempts integer NOT NULL DEFAULT 0,
  started_at timestamptz NULL, sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS brand_operations_owner_workspace_created_idx ON public.brand_operations (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brand_operation_events_operation_idx ON public.brand_operation_events (operation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS brand_boost_jobs_workspace_idx ON public.brand_boost_jobs (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crawler_hits_workspace_idx ON public.crawler_hits (user_id, workspace_id, hit_at DESC);

GRANT SELECT ON public.brand_operations, public.brand_operation_events, public.brand_boost_report_settings, public.brand_boost_report_deliveries TO authenticated;
GRANT ALL ON public.brand_operations, public.brand_operation_events, public.brand_boost_report_settings, public.brand_boost_report_deliveries, public.crawler_ip_verifications TO service_role;
ALTER TABLE public.brand_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_operation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_ip_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_boost_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_boost_report_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_operations_owner_select ON public.brand_operations;
CREATE POLICY brand_operations_owner_select ON public.brand_operations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS brand_operation_events_owner_select ON public.brand_operation_events;
CREATE POLICY brand_operation_events_owner_select ON public.brand_operation_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS crawler_ip_verifications_no_client_access ON public.crawler_ip_verifications;
DROP POLICY IF EXISTS brand_boost_report_settings_owner_select ON public.brand_boost_report_settings;
CREATE POLICY brand_boost_report_settings_owner_select ON public.brand_boost_report_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS brand_boost_report_deliveries_owner_select ON public.brand_boost_report_deliveries;
CREATE POLICY brand_boost_report_deliveries_owner_select ON public.brand_boost_report_deliveries FOR SELECT TO authenticated USING (auth.uid() = user_id);