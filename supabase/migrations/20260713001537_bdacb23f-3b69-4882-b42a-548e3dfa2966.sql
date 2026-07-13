
-- 1) workspaces
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'own' CHECK (kind IN ('own','client','brand')),
  brand_url text,
  brand_summary text,
  keywords text[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'ar',
  country text,
  city text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage workspaces" ON public.workspaces
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "admins view all workspaces" ON public.workspaces
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER workspaces_touch BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) workspace_members (للتشارك مستقبلاً)
CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','editor','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages members" ON public.workspace_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );
CREATE POLICY "members view self" ON public.workspace_members
  FOR SELECT USING (auth.uid() = user_id);

-- 3) توسيع maaroof_runs
ALTER TABLE public.maaroof_runs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES public.maaroof_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_id uuid,
  ADD COLUMN IF NOT EXISTS auto_run boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_maaroof_runs_workspace ON public.maaroof_runs(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_maaroof_runs_parent ON public.maaroof_runs(parent_run_id);

-- 4) توسيع maaroof_memory
ALTER TABLE public.maaroof_memory
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_maaroof_memory_workspace ON public.maaroof_memory(workspace_id, importance DESC);

-- 5) توسيع agent_tasks (للتوافق مع نظام agent القديم)
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 6) maaroof_schedules
CREATE TABLE public.maaroof_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  force_tools text[] NOT NULL DEFAULT '{}',
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('once','hourly','daily','weekly','custom_cron')),
  cron_expr text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  max_runs integer NOT NULL DEFAULT 0,
  runs_done integer NOT NULL DEFAULT 0,
  next_run_at timestamptz,
  last_run_at timestamptz,
  approval_mode text NOT NULL DEFAULT 'per_run' CHECK (approval_mode IN ('per_run','auto_within_quota','first_time_then_auto')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','exhausted','cancelled')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_maaroof_schedules_user ON public.maaroof_schedules(user_id, status);
CREATE INDEX idx_maaroof_schedules_due ON public.maaroof_schedules(status, next_run_at) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maaroof_schedules TO authenticated;
GRANT ALL ON public.maaroof_schedules TO service_role;
ALTER TABLE public.maaroof_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own schedules" ON public.maaroof_schedules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all schedules" ON public.maaroof_schedules
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER maaroof_schedules_touch BEFORE UPDATE ON public.maaroof_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
