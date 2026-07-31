-- ============ Part 19.2 — Reality Execution Engine ============
CREATE TABLE public.executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  run_id TEXT,
  goal TEXT NOT NULL,
  strategy TEXT,
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  mode TEXT NOT NULL DEFAULT 'simulation',
  status TEXT NOT NULL DEFAULT 'draft',
  priority INTEGER NOT NULL DEFAULT 50,
  expected_outcome TEXT,
  measured_outcome TEXT,
  outcome_score INTEGER,
  reality_state TEXT,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'ar',
  approval_required BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executions TO authenticated;
GRANT ALL ON public.executions TO service_role;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "executions_owner_all" ON public.executions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "executions_admin_all" ON public.executions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER executions_touch BEFORE UPDATE ON public.executions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX executions_user_idx ON public.executions (user_id, created_at DESC);
CREATE INDEX executions_status_idx ON public.executions (status);

CREATE TABLE public.execution_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.executions(id) ON DELETE CASCADE,
  user_id UUID,
  seq INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  capability_key TEXT,
  expert_key TEXT,
  agent_key TEXT,
  model_key TEXT,
  mcp_provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  measured JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execution_tasks TO authenticated;
GRANT ALL ON public.execution_tasks TO service_role;
ALTER TABLE public.execution_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "execution_tasks_owner_all" ON public.execution_tasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "execution_tasks_admin_all" ON public.execution_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER execution_tasks_touch BEFORE UPDATE ON public.execution_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX execution_tasks_exec_idx ON public.execution_tasks (execution_id, seq);

CREATE TABLE public.execution_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.executions(id) ON DELETE CASCADE,
  task_id UUID,
  user_id UUID,
  stage TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.execution_events TO authenticated;
GRANT ALL ON public.execution_events TO service_role;
ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "execution_events_owner_read" ON public.execution_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "execution_events_owner_insert" ON public.execution_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX execution_events_exec_idx ON public.execution_events (execution_id, created_at DESC);

-- ============ Part 19.4 — Evidence Engine (extend, never replace) ============
ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS evidence_type TEXT,
  ADD COLUMN IF NOT EXISTS source_reliability INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS collection_method TEXT,
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS expert_key TEXT,
  ADD COLUMN IF NOT EXISTS execution_id UUID,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freshness INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS business_value INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS verification_history JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS evidence_items_execution_idx ON public.evidence_items (execution_id);

-- ============ Part 19.4 — Benchmark Engine ============
CREATE TABLE public.benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  subject TEXT NOT NULL,
  subject_kind TEXT NOT NULL DEFAULT 'tool',
  metric TEXT NOT NULL,
  unit TEXT,
  baseline NUMERIC,
  target NUMERIC,
  higher_is_better BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_kind, subject, metric)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.benchmarks TO authenticated;
GRANT ALL ON public.benchmarks TO service_role;
ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benchmarks_read" ON public.benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "benchmarks_admin_write" ON public.benchmarks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER benchmarks_touch BEFORE UPDATE ON public.benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.benchmark_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  benchmark_id UUID NOT NULL REFERENCES public.benchmarks(id) ON DELETE CASCADE,
  user_id UUID,
  execution_id UUID,
  run_id TEXT,
  value NUMERIC NOT NULL,
  delta_vs_baseline NUMERIC,
  passed BOOLEAN,
  sample_size INTEGER NOT NULL DEFAULT 1,
  source TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.benchmark_results TO authenticated;
GRANT ALL ON public.benchmark_results TO service_role;
ALTER TABLE public.benchmark_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benchmark_results_read" ON public.benchmark_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "benchmark_results_insert" ON public.benchmark_results FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX benchmark_results_bm_idx ON public.benchmark_results (benchmark_id, created_at DESC);

-- ============ Part 19.5 — Reality Lab ============
CREATE TABLE public.lab_experiments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  title TEXT NOT NULL,
  objective TEXT,
  hypothesis TEXT,
  scope TEXT NOT NULL DEFAULT 'platform',
  subject TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  method TEXT,
  sample_target INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'draft',
  conclusion TEXT,
  reproduced BOOLEAN NOT NULL DEFAULT false,
  reality_state TEXT,
  confidence INTEGER NOT NULL DEFAULT 0,
  knowledge_impact INTEGER NOT NULL DEFAULT 0,
  trust_impact INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_experiments TO authenticated;
GRANT ALL ON public.lab_experiments TO service_role;
ALTER TABLE public.lab_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_experiments_owner_all" ON public.lab_experiments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "lab_experiments_admin_all" ON public.lab_experiments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER lab_experiments_touch BEFORE UPDATE ON public.lab_experiments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.lab_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.lab_experiments(id) ON DELETE CASCADE,
  user_id UUID,
  execution_id UUID,
  iteration INTEGER NOT NULL DEFAULT 1,
  expected JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched BOOLEAN,
  deviation NUMERIC,
  reality_state TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lab_runs TO authenticated;
GRANT ALL ON public.lab_runs TO service_role;
ALTER TABLE public.lab_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_runs_read" ON public.lab_runs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lab_runs_insert" ON public.lab_runs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX lab_runs_exp_idx ON public.lab_runs (experiment_id, iteration);