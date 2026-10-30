-- Brand Boost scheduling, crawler verification cache, and opt-in monthly email reports.
-- No raw client IP is persisted; only a SHA-256 digest is used for DNS verification caching.

ALTER TABLE public.crawler_hits
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'user_agent_only',
  ADD COLUMN IF NOT EXISTS verified_hostname text NULL,
  ADD COLUMN IF NOT EXISTS verification_method text NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS public.crawler_ip_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  bot_name text NOT NULL,
  verification_status text NOT NULL,
  verified_hostname text NULL,
  verification_method text NOT NULL DEFAULT 'ptr_forward_confirm',
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (ip_hash, bot_name)
);
CREATE INDEX IF NOT EXISTS crawler_ip_verifications_expiry_idx
  ON public.crawler_ip_verifications (expires_at);

ALTER TABLE public.crawler_ip_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crawler_ip_verifications_no_client_access ON public.crawler_ip_verifications;
CREATE POLICY crawler_ip_verifications_no_client_access
  ON public.crawler_ip_verifications FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.brand_boost_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_to text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_boost_report_settings_account_unique
  ON public.brand_boost_report_settings (user_id) WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS brand_boost_report_settings_workspace_unique
  ON public.brand_boost_report_settings (user_id, workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS brand_boost_report_settings_enabled_idx
  ON public.brand_boost_report_settings (enabled, updated_at DESC);

ALTER TABLE public.brand_boost_report_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_boost_report_settings_owner_select ON public.brand_boost_report_settings;
CREATE POLICY brand_boost_report_settings_owner_select
  ON public.brand_boost_report_settings FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.brand_boost_report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_month text NOT NULL,
  email_to text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text NULL,
  error_message text NULL,
  attempts integer NOT NULL DEFAULT 0,
  started_at timestamptz NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_boost_report_deliveries_owner_idx
  ON public.brand_boost_report_deliveries (user_id, workspace_id, report_month DESC);
CREATE INDEX IF NOT EXISTS brand_boost_report_deliveries_retry_idx
  ON public.brand_boost_report_deliveries (status, updated_at);

ALTER TABLE public.brand_boost_report_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_boost_report_deliveries_owner_select ON public.brand_boost_report_deliveries;
CREATE POLICY brand_boost_report_deliveries_owner_select
  ON public.brand_boost_report_deliveries FOR SELECT USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
