-- Reassert workspace scoping support for job history; all clauses are idempotent.
-- Existing jobs remain valid with workspace_id = NULL and remain queryable by user_id.
ALTER TABLE public.maaroof_jobs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS maaroof_jobs_workspace_idx
  ON public.maaroof_jobs (user_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS maaroof_jobs_user_created_idx
  ON public.maaroof_jobs (user_id, created_at DESC);
