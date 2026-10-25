-- Scope competitive-discovery runs to the selected workspace.
-- Existing account-level rows retain NULL and remain visible only in the default workspace.
ALTER TABLE public.mkd_runs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS mkd_runs_user_workspace_created_idx
  ON public.mkd_runs (user_id, workspace_id, created_at DESC);
