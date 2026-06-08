ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS run_id uuid,
  ADD COLUMN IF NOT EXISTS run_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_run ON public.agent_tasks(user_id, run_id, created_at DESC);