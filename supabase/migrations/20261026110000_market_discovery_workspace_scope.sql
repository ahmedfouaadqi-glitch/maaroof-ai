-- Scope existing market-discovery runs, relations, and reality records to their client workspace.
-- These are additive nullable columns; legacy/main-account rows remain in workspace_id IS NULL.
ALTER TABLE public.mkd_runs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.mkd_relations
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.reality_records
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS mkd_runs_user_workspace_created_idx
  ON public.mkd_runs (user_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mkd_relations_user_workspace_run_idx
  ON public.mkd_relations (user_id, workspace_id, run_id);

CREATE INDEX IF NOT EXISTS reality_records_user_workspace_created_idx
  ON public.reality_records (user_id, workspace_id, created_at DESC);
