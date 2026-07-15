
-- Phase 2A: Workspace Intelligence
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS success_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_models jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_experts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_mcp jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS budget jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Phase 2B: Living Memory Evolution
ALTER TABLE public.maaroof_memory
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS freshness_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reliability numeric(4,3),
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decision_impact numeric(4,3),
  ADD COLUMN IF NOT EXISTS learning_score numeric(4,3);

CREATE INDEX IF NOT EXISTS maaroof_memory_workspace_idx
  ON public.maaroof_memory (workspace_id, kind, importance DESC, last_accessed_at DESC);

-- Phase 2F: Platform Intelligence aggregate view (no PII)
DROP VIEW IF EXISTS public.platform_intelligence_v;
CREATE VIEW public.platform_intelligence_v
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', r.created_at)::date AS day,
  count(*)                              AS runs,
  count(*) FILTER (WHERE r.status = 'done')  AS runs_done,
  count(*) FILTER (WHERE r.status = 'error') AS runs_error,
  coalesce(avg(r.total_usd), 0)         AS avg_usd,
  coalesce(avg(r.total_tokens), 0)      AS avg_tokens,
  coalesce(avg(r.steps_count), 0)       AS avg_steps,
  coalesce(avg(jsonb_array_length(coalesce(r.decision_log, '[]'::jsonb))), 0) AS avg_decisions
FROM public.maaroof_runs r
GROUP BY 1
ORDER BY 1 DESC;

GRANT SELECT ON public.platform_intelligence_v TO authenticated;
GRANT SELECT ON public.platform_intelligence_v TO service_role;
