
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cognitive_consent text NOT NULL DEFAULT 'dna_only';
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_cognitive_consent_chk
    CHECK (cognitive_consent IN ('none','dna_only','full'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.maaroof_memory
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS consent_level text NOT NULL DEFAULT 'full';

CREATE TABLE IF NOT EXISTS public.platform_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 1,
  source_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_dna_kind_idx ON public.platform_dna(kind, created_at DESC);
GRANT SELECT ON public.platform_dna TO authenticated;
GRANT ALL ON public.platform_dna TO service_role;
ALTER TABLE public.platform_dna ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_dna admin read" ON public.platform_dna;
CREATE POLICY "platform_dna admin read" ON public.platform_dna
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.maaroof_evolution_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evo_reports_period_idx ON public.maaroof_evolution_reports(period, created_at DESC);
GRANT SELECT ON public.maaroof_evolution_reports TO authenticated;
GRANT ALL ON public.maaroof_evolution_reports TO service_role;
ALTER TABLE public.maaroof_evolution_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evo_reports admin read" ON public.maaroof_evolution_reports;
CREATE POLICY "evo_reports admin read" ON public.maaroof_evolution_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.expert_scores_v
WITH (security_invoker = on) AS
SELECT
  tl.tool_key AS expert,
  COUNT(*)::int AS runs,
  ROUND(AVG(tl.usd_cost)::numeric, 6) AS avg_usd,
  ROUND(AVG(tl.tokens)::numeric, 2)   AS avg_tokens,
  MAX(tl.created_at) AS last_used_at
FROM public.token_ledger tl
WHERE tl.tool_key IS NOT NULL
GROUP BY tl.tool_key;

CREATE OR REPLACE VIEW public.model_scores_v
WITH (security_invoker = on) AS
SELECT
  COALESCE(NULLIF(tl.meta->>'model',''), 'unknown') AS model,
  COUNT(*)::int AS calls,
  ROUND(AVG(tl.usd_cost)::numeric, 6) AS avg_usd,
  ROUND(AVG(tl.tokens)::numeric, 2)   AS avg_tokens,
  MAX(tl.created_at) AS last_used_at
FROM public.token_ledger tl
GROUP BY 1;

CREATE OR REPLACE VIEW public.mcp_scores_v
WITH (security_invoker = on) AS
SELECT
  mp.id, mp.name, mp.enabled,
  COALESCE(mp.reliability, 0) AS reliability,
  COALESCE(mp.avg_cost_usd, 0) AS avg_cost_usd,
  COALESCE(mp.avg_latency_ms, 0) AS avg_latency_ms,
  mp.capabilities, mp.workspace_id, mp.updated_at
FROM public.mcp_providers mp;

CREATE OR REPLACE VIEW public.policy_scores_v
WITH (security_invoker = on) AS
SELECT
  COALESCE(NULLIF(w.risk_level,''), 'balanced') AS policy,
  COUNT(*)::int AS workspaces,
  MAX(w.updated_at) AS last_updated_at
FROM public.workspaces w
GROUP BY 1;
