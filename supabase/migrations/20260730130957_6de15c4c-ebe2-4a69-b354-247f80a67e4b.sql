ALTER TABLE public.maaroof_agents
  ADD COLUMN IF NOT EXISTS personality jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS personality_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.maaroof_runs
  ADD COLUMN IF NOT EXISTS timing jsonb,
  ADD COLUMN IF NOT EXISTS trust jsonb;

CREATE OR REPLACE VIEW public.executive_quality_index_v
WITH (security_invoker = on) AS
SELECT
  date_trunc('day', r.started_at) AS day,
  count(*)::bigint AS runs,
  round(avg((r.quality_score->>'decision')::numeric), 3) AS decision,
  round(avg((r.quality_score->>'planning')::numeric), 3) AS planning,
  round(avg((r.quality_score->>'expert')::numeric), 3) AS expert,
  round(avg((r.quality_score->>'capability')::numeric), 3) AS capability,
  round(avg((r.quality_score->>'memory')::numeric), 3) AS memory,
  round(avg((r.quality_score->>'simulation')::numeric), 3) AS simulation,
  round(avg((r.quality_score->>'execution')::numeric), 3) AS execution,
  round(avg((r.quality_score->>'reflection')::numeric), 3) AS reflection,
  round(avg((r.quality_score->>'learning')::numeric), 3) AS learning,
  round(avg((r.quality_score->>'cost_efficiency')::numeric), 3) AS cost_efficiency,
  round(avg((r.quality_score->>'user_satisfaction')::numeric), 3) AS user_satisfaction,
  round(avg(r.total_usd), 6) AS avg_usd
FROM public.maaroof_runs r
WHERE r.quality_score IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

GRANT SELECT ON public.executive_quality_index_v TO authenticated;
GRANT SELECT ON public.executive_quality_index_v TO service_role;