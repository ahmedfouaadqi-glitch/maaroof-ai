
ALTER TABLE public.maaroof_runs
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'execution'
    CHECK (execution_mode IN ('simulation','recommendation','execution')),
  ADD COLUMN IF NOT EXISTS workflow_state text,
  ADD COLUMN IF NOT EXISTS quality_score jsonb;

ALTER TABLE public.maaroof_schedules
  ADD COLUMN IF NOT EXISTS workflow_graph jsonb;

ALTER TABLE public.whatif_scenarios
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'market',
  ADD COLUMN IF NOT EXISTS axes jsonb;

CREATE OR REPLACE VIEW public.run_quality_v
WITH (security_invoker = on)
AS
SELECT
  count(*) FILTER (WHERE quality_score IS NOT NULL) AS scored_runs,
  avg((quality_score->>'decision')::numeric)          AS avg_decision,
  avg((quality_score->>'planning')::numeric)          AS avg_planning,
  avg((quality_score->>'expert')::numeric)            AS avg_expert,
  avg((quality_score->>'capability')::numeric)        AS avg_capability,
  avg((quality_score->>'memory')::numeric)            AS avg_memory,
  avg((quality_score->>'simulation')::numeric)        AS avg_simulation,
  avg((quality_score->>'execution')::numeric)         AS avg_execution,
  avg((quality_score->>'reflection')::numeric)        AS avg_reflection,
  avg((quality_score->>'learning')::numeric)          AS avg_learning,
  avg((quality_score->>'cost_efficiency')::numeric)   AS avg_cost_efficiency,
  avg((quality_score->>'user_satisfaction')::numeric) AS avg_user_satisfaction
FROM public.maaroof_runs
WHERE quality_score IS NOT NULL;

GRANT SELECT ON public.run_quality_v TO authenticated;
GRANT SELECT ON public.run_quality_v TO service_role;
