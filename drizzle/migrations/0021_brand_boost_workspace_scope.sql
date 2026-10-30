-- Workspace-scope Brand Boost jobs, authority packs, and crawler observations.
-- Existing account-level rows remain workspace_id = NULL for backwards compatibility.

ALTER TABLE public.brand_boost_jobs
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.brand_boost_runs
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.brand_authority_packs
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.crawler_hits
  ADD COLUMN IF NOT EXISTS workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS brand_boost_jobs_workspace_idx
  ON public.brand_boost_jobs (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brand_boost_runs_workspace_idx
  ON public.brand_boost_runs (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brand_authority_packs_workspace_idx
  ON public.brand_authority_packs (user_id, workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS crawler_hits_workspace_idx
  ON public.crawler_hits (user_id, workspace_id, hit_at DESC);

NOTIFY pgrst, 'reload schema';
