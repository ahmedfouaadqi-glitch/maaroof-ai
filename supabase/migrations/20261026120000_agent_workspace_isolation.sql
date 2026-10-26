-- Workspace isolation for autonomous agent targets, tasks, channels and publication history.
-- Existing account-level records remain NULL and stay attached to the main account.
ALTER TABLE public.agent_targets
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.publish_channels
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.publish_log
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS agent_targets_user_workspace_created_idx
  ON public.agent_targets (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_tasks_user_workspace_created_idx
  ON public.agent_tasks (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS publish_channels_user_workspace_created_idx
  ON public.publish_channels (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS publish_log_user_workspace_created_idx
  ON public.publish_log (user_id, workspace_id, created_at DESC);
