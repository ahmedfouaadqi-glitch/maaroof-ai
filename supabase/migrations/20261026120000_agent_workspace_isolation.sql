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

ALTER TABLE public.oauth_link_states
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS oauth_link_states_user_workspace_idx
  ON public.oauth_link_states (user_id, workspace_id, created_at DESC);

-- Defense in depth: even service-role inserts must not associate a user's row
-- with a workspace owned by someone else.
CREATE OR REPLACE FUNCTION public.enforce_workspace_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  workspace_owner uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO workspace_owner
  FROM public.workspaces
  WHERE id = NEW.workspace_id;

  IF workspace_owner IS NULL OR workspace_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'workspace_owner_mismatch'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_agent_targets_workspace_owner ON public.agent_targets;
CREATE TRIGGER enforce_agent_targets_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.agent_targets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();

DROP TRIGGER IF EXISTS enforce_agent_tasks_workspace_owner ON public.agent_tasks;
CREATE TRIGGER enforce_agent_tasks_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();

DROP TRIGGER IF EXISTS enforce_publish_channels_workspace_owner ON public.publish_channels;
CREATE TRIGGER enforce_publish_channels_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.publish_channels
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();

DROP TRIGGER IF EXISTS enforce_publish_log_workspace_owner ON public.publish_log;
CREATE TRIGGER enforce_publish_log_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.publish_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();

DROP TRIGGER IF EXISTS enforce_oauth_link_states_workspace_owner ON public.oauth_link_states;
CREATE TRIGGER enforce_oauth_link_states_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.oauth_link_states
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();

DROP TRIGGER IF EXISTS enforce_task_attachments_workspace_owner ON public.task_attachments;
CREATE TRIGGER enforce_task_attachments_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();

DROP TRIGGER IF EXISTS enforce_knowledge_facts_workspace_owner ON public.knowledge_facts;
CREATE TRIGGER enforce_knowledge_facts_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.knowledge_facts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();

DROP TRIGGER IF EXISTS enforce_maaroof_schedules_workspace_owner ON public.maaroof_schedules;
CREATE TRIGGER enforce_maaroof_schedules_workspace_owner
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON public.maaroof_schedules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_owner();
