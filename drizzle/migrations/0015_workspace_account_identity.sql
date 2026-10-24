-- Give each workspace its own entity truth card, onboarding context, and settings.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS entity_truth_card jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{"status":"not_started","answers":{}}'::jsonb,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"scope":"workspace","memory_isolation":"strict"}'::jsonb;

CREATE INDEX IF NOT EXISTS workspaces_owner_updated_idx
  ON public.workspaces (owner_id, updated_at DESC);
