ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tool_geo_scopes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quota_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;