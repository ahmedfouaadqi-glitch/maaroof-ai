-- Require ownership verification for recipients of private Brand Boost email reports.
ALTER TABLE public.brand_boost_report_settings
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_code_hash text NULL,
  ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0;

-- Existing enabled recipients have not completed the new verification flow.
UPDATE public.brand_boost_report_settings
SET enabled = false,
    email_verified_at = NULL,
    verification_code_hash = NULL,
    verification_expires_at = NULL,
    verification_attempts = 0
WHERE enabled = true;

CREATE INDEX IF NOT EXISTS brand_boost_report_settings_verified_enabled_idx
  ON public.brand_boost_report_settings (enabled, email_verified_at)
  WHERE enabled = true AND email_verified_at IS NOT NULL;
