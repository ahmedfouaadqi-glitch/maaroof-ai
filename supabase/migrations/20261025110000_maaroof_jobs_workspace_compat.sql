-- Idempotent production migration for resilient workspace-aware task history.
-- Rows created before this migration keep NULL workspace_id and remain queryable by user_id.
ALTER TABLE public.maaroof_jobs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS maaroof_jobs_workspace_idx
  ON public.maaroof_jobs (user_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS maaroof_jobs_user_created_idx
  ON public.maaroof_jobs (user_id, created_at DESC);
