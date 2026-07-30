-- Part 12 — AI Model Governance
CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL UNIQUE,
  provider text NOT NULL,
  version text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  speed integer NOT NULL DEFAULT 50,
  latency_ms integer,
  reliability numeric NOT NULL DEFAULT 0.95,
  cost_in_usd_per_mtok numeric NOT NULL DEFAULT 0,
  cost_out_usd_per_mtok numeric NOT NULL DEFAULT 0,
  languages jsonb NOT NULL DEFAULT '["ar","en","ku"]'::jsonb,
  supported_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  supported_mcp jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_use_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  released_at date,
  last_evaluated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_models TO authenticated;
GRANT ALL ON public.ai_models TO service_role;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_models_read_auth" ON public.ai_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_models_admin_all" ON public.ai_models FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ai_models_touch BEFORE UPDATE ON public.ai_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ai_model_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL,
  kind text NOT NULL DEFAULT 'adopt',
  reason text NOT NULL,
  pros jsonb NOT NULL DEFAULT '[]'::jsonb,
  cons jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_cost_usd numeric,
  expected_cost_usd numeric,
  impact jsonb NOT NULL DEFAULT '{}'::jsonb,
  migration_plan text,
  test_plan text,
  rollback_plan text,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_gain_pct numeric,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_proposals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_proposals TO authenticated;
ALTER TABLE public.ai_model_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_model_proposals_admin_all" ON public.ai_model_proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_model_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  task text NOT NULL,
  model_key text NOT NULL,
  accuracy numeric,
  reasoning_score numeric,
  latency_ms integer,
  tokens integer NOT NULL DEFAULT 0,
  usd numeric NOT NULL DEFAULT 0,
  output_sample text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_benchmarks TO service_role;
GRANT SELECT, INSERT, DELETE ON public.ai_model_benchmarks TO authenticated;
ALTER TABLE public.ai_model_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_model_benchmarks_admin_all" ON public.ai_model_benchmarks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_model_health (
  model_key text PRIMARY KEY,
  calls integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  total_latency_ms bigint NOT NULL DEFAULT 0,
  total_tokens bigint NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  last_error text,
  last_status text,
  last_call_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_health TO service_role;
GRANT SELECT ON public.ai_model_health TO authenticated;
ALTER TABLE public.ai_model_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_model_health_admin_read" ON public.ai_model_health FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Part 13 — Executive Decision Intelligence
CREATE TABLE public.decision_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  user_id uuid,
  workspace_id uuid,
  stage text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  experts jsonb NOT NULL DEFAULT '[]'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  mcp jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_usd numeric NOT NULL DEFAULT 0,
  risk numeric,
  duration_ms integer,
  confidence numeric,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decision_traces_run_idx ON public.decision_traces (run_id, seq);
CREATE INDEX decision_traces_user_idx ON public.decision_traces (user_id, created_at DESC);
GRANT ALL ON public.decision_traces TO service_role;
GRANT SELECT ON public.decision_traces TO authenticated;
ALTER TABLE public.decision_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decision_traces_own_read" ON public.decision_traces FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Seed the registry with the models actually available to this platform.
INSERT INTO public.ai_models
  (model_key, provider, version, capabilities, strengths, weaknesses, speed, reliability,
   cost_in_usd_per_mtok, cost_out_usd_per_mtok, recommended_use_cases, limitations, status)
VALUES
 ('google/gemini-2.5-pro','google','2.5',
  '{"reasoning":90,"coding":85,"vision":true,"audio":true,"video":true,"long_context":true}',
  '["deep reasoning","long context","multimodal"]','["higher cost","slower"]',55,0.97,1.25,10.0,
  '["planning","council","final answer"]','["cost-sensitive high volume"]','active'),
 ('google/gemini-2.5-flash','google','2.5',
  '{"reasoning":75,"coding":72,"vision":true,"audio":true,"video":true,"long_context":true}',
  '["fast","cheap","multimodal"]','["weaker deep reasoning"]',85,0.97,0.30,2.50,
  '["reflection","extraction","learning sessions"]','["complex multi-step reasoning"]','active'),
 ('google/gemini-2.5-flash-lite','google','2.5',
  '{"reasoning":60,"coding":55,"vision":true,"audio":true,"video":true,"long_context":true}',
  '["cheapest","lowest latency"]','["shallow reasoning"]',95,0.96,0.10,0.40,
  '["classification","summarization","high volume"]','["planning","analysis"]','active'),
 ('openai/gpt-5','openai','5',
  '{"reasoning":93,"coding":90,"vision":true,"audio":false,"video":false,"long_context":true}',
  '["accuracy","nuance"]','["expensive"]',50,0.97,1.25,10.0,
  '["hard analysis","final answer"]','["high volume"]','candidate'),
 ('openai/gpt-5-mini','openai','5',
  '{"reasoning":80,"coding":78,"vision":true,"audio":false,"video":false,"long_context":true}',
  '["balanced cost/quality"]','["less nuance than gpt-5"]',75,0.97,0.25,2.0,
  '["general reasoning","sub-agents"]','[]','candidate'),
 ('openai/gpt-5-nano','openai','5',
  '{"reasoning":62,"coding":58,"vision":true,"audio":false,"video":false,"long_context":true}',
  '["fast","cheap"]','["shallow"]',93,0.96,0.05,0.40,
  '["simple tasks","classification"]','["planning"]','candidate');