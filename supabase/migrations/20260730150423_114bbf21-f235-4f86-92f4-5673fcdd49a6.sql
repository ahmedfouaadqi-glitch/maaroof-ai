CREATE TABLE public.hermes_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  priority integer NOT NULL DEFAULT 3,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  expert_assignment text[] NOT NULL DEFAULT '{}',
  sub_agent_assignment text[] NOT NULL DEFAULT '{}',
  required_models text[] NOT NULL DEFAULT '{}',
  required_mcp text[] NOT NULL DEFAULT '{}',
  required_tools text[] NOT NULL DEFAULT '{}',
  business_goal text,
  expected_output text,
  approval_level text NOT NULL DEFAULT 'founder',
  dependencies uuid[] NOT NULL DEFAULT '{}',
  risk_level text NOT NULL DEFAULT 'low',
  cost_budget_usd numeric,
  token_budget integer,
  execution_budget_ms integer,
  languages text[] NOT NULL DEFAULT ARRAY['ar'],
  knowledge_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  deadline timestamptz,
  start_at timestamptz,
  finish_at timestamptz,
  timezone text NOT NULL DEFAULT 'Asia/Baghdad',
  recurring_schedule text,
  schedule_id uuid REFERENCES public.maaroof_schedules(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting',
  progress integer NOT NULL DEFAULT 0,
  execution_mode text NOT NULL DEFAULT 'manual',
  spent_usd numeric NOT NULL DEFAULT 0,
  spent_tokens integer NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_tasks TO authenticated;
GRANT ALL ON public.hermes_tasks TO service_role;

ALTER TABLE public.hermes_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage hermes tasks"
ON public.hermes_tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_hermes_tasks_updated_at
BEFORE UPDATE ON public.hermes_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_hermes_tasks_status ON public.hermes_tasks(status);
CREATE INDEX idx_hermes_tasks_start_at ON public.hermes_tasks(start_at);

CREATE TABLE public.hermes_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.hermes_tasks(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.hermes_task_events TO authenticated;
GRANT ALL ON public.hermes_task_events TO service_role;

ALTER TABLE public.hermes_task_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read hermes task events"
ON public.hermes_task_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins write hermes task events"
ON public.hermes_task_events FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_hermes_task_events_task ON public.hermes_task_events(task_id, created_at DESC);