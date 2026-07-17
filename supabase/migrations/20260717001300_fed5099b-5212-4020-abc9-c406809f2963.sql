
CREATE TABLE public.maaroof_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  parent_agent_id uuid REFERENCES public.maaroof_agents(id) ON DELETE SET NULL,
  role text NOT NULL,
  mission text,
  dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  lifecycle_state text NOT NULL DEFAULT 'created'
    CHECK (lifecycle_state IN ('created','initialized','learning','planning','executing','reflecting','optimizing','standby','reactivated','merged','archived','deleted')),
  success_rate numeric,
  runs_count int NOT NULL DEFAULT 0,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX maaroof_agents_user_idx ON public.maaroof_agents(user_id);
CREATE INDEX maaroof_agents_workspace_idx ON public.maaroof_agents(workspace_id);
CREATE INDEX maaroof_agents_lifecycle_idx ON public.maaroof_agents(lifecycle_state);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maaroof_agents TO authenticated;
GRANT ALL ON public.maaroof_agents TO service_role;

ALTER TABLE public.maaroof_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their agents"
  ON public.maaroof_agents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Workspace members can view agents"
  ON public.maaroof_agents FOR SELECT
  USING (
    workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = maaroof_agents.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all agents"
  ON public.maaroof_agents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_maaroof_agents_updated
  BEFORE UPDATE ON public.maaroof_agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Additive columns on existing agent_tasks (all nullable, backward compatible)
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.maaroof_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.maaroof_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lifecycle_state text,
  ADD COLUMN IF NOT EXISTS confidence jsonb;
