
-- =========================================================================
-- Part 4 — Capability Operating System (additive migration)
-- =========================================================================

-- 1) mcp_providers — external capability sources (Hybrid MCP registry)
CREATE TABLE IF NOT EXISTS public.mcp_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_kind text NOT NULL DEFAULT 'none',
  scopes text[] NOT NULL DEFAULT '{}',
  endpoint text,
  avg_cost_usd numeric,
  avg_latency_ms integer,
  reliability numeric,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_providers TO authenticated;
GRANT ALL ON public.mcp_providers TO service_role;

ALTER TABLE public.mcp_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_providers owner all"
  ON public.mcp_providers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mcp_providers admin all"
  ON public.mcp_providers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "mcp_providers workspace members select"
  ON public.mcp_providers FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = mcp_providers.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_mcp_providers_touch
  BEFORE UPDATE ON public.mcp_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) maaroof_runs — additive queue/lifecycle columns
ALTER TABLE public.maaroof_runs
  ADD COLUMN IF NOT EXISTS queue_state text NOT NULL DEFAULT 'succeeded',
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_run_id uuid,
  ADD COLUMN IF NOT EXISTS depends_on_run_id uuid;

-- 3) maaroof_schedules — additive advanced fields
ALTER TABLE public.maaroof_schedules
  ADD COLUMN IF NOT EXISTS capabilities jsonb,
  ADD COLUMN IF NOT EXISTS cost_limit_usd numeric,
  ADD COLUMN IF NOT EXISTS token_limit integer,
  ADD COLUMN IF NOT EXISTS retry_rules jsonb,
  ADD COLUMN IF NOT EXISTS approval_rules jsonb,
  ADD COLUMN IF NOT EXISTS conditions jsonb;

-- 4) capability_scores_v — aggregated live metrics per capability
-- Uses an inline VALUES mapping so we don't duplicate the static registry
-- into a data table. Kept in sync manually with src/lib/tool-catalog.ts.
CREATE OR REPLACE VIEW public.capability_scores_v AS
WITH capability_tool_map(tool_key, capability) AS (
  VALUES
    ('analyze','geo_analysis'), ('analyze','visibility'), ('analyze','knowledge_extraction'),
    ('suggest','writing'), ('suggest','content_generation'),
    ('compare','competitor_analysis'), ('compare','market_intelligence'),
    ('feasibility','forecasting'), ('feasibility','market_intelligence'), ('feasibility','planning'),
    ('bizdev','business_development'), ('bizdev','planning'), ('bizdev','market_intelligence'),
    ('research','research'), ('research','knowledge_extraction'), ('research','market_intelligence'),
    ('visibility','visibility'), ('visibility','aeo'), ('visibility','monitoring'),
    ('brand_boost','brand_strategy'), ('brand_boost','content_generation'), ('brand_boost','planning'),
    ('company_email','email_outreach'), ('company_email','writing'),
    ('applied_ranking','ranking'), ('applied_ranking','seo'), ('applied_ranking','geo_analysis'),
    ('geo_strategist','planning'), ('geo_strategist','geo_analysis'), ('geo_strategist','brand_strategy'),
    ('competitor_monitor','monitoring'), ('competitor_monitor','competitor_analysis'),
    ('social_analysis','social_analysis'), ('social_analysis','visibility'),
    ('what_if','scenario_simulation'), ('what_if','forecasting'),
    ('brand_authority','brand_authority'), ('brand_authority','brand_strategy'), ('brand_authority','seo'),
    ('geo_rewrite','writing'), ('geo_rewrite','geo_analysis'), ('geo_rewrite','content_generation')
),
ledger_agg AS (
  SELECT m.capability,
         count(*)::int AS invocations,
         coalesce(sum(t.tokens),0)::bigint AS total_tokens,
         coalesce(sum(t.usd_cost),0)::numeric AS total_usd,
         avg(t.usd_cost)::numeric AS avg_usd
  FROM public.token_ledger t
  JOIN capability_tool_map m ON m.tool_key = t.tool_key
  GROUP BY m.capability
),
run_agg AS (
  SELECT m.capability,
         count(*)::int AS runs,
         count(*) FILTER (WHERE r.status = 'ok')::int AS ok_runs,
         count(*) FILTER (WHERE r.status = 'error')::int AS error_runs,
         avg(EXTRACT(EPOCH FROM (r.finished_at - r.started_at)))::numeric AS avg_duration_s
  FROM public.maaroof_runs r
  JOIN capability_tool_map m ON true
  WHERE r.decision_log::text ILIKE '%' || m.tool_key || '%'
  GROUP BY m.capability
)
SELECT
  coalesce(l.capability, r.capability) AS capability,
  coalesce(l.invocations, 0) AS invocations,
  coalesce(l.total_tokens, 0) AS total_tokens,
  coalesce(l.total_usd, 0) AS total_usd,
  coalesce(l.avg_usd, 0) AS avg_usd,
  coalesce(r.runs, 0) AS runs,
  coalesce(r.ok_runs, 0) AS ok_runs,
  coalesce(r.error_runs, 0) AS error_runs,
  CASE WHEN coalesce(r.runs,0) > 0
       THEN (r.ok_runs::numeric / r.runs::numeric)
       ELSE NULL END AS success_rate,
  r.avg_duration_s
FROM ledger_agg l
FULL OUTER JOIN run_agg r ON l.capability = r.capability;

GRANT SELECT ON public.capability_scores_v TO authenticated;
GRANT SELECT ON public.capability_scores_v TO service_role;
