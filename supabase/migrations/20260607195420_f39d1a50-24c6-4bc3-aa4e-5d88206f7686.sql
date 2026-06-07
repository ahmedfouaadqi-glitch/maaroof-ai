
-- 1) Widen USD precision to support sub-cent (milli-cent) costs
ALTER TABLE public.subscription_plans ALTER COLUMN price_usd TYPE numeric(12,6);
ALTER TABLE public.tool_plan_access  ALTER COLUMN usd_per_use TYPE numeric(12,6);
ALTER TABLE public.token_ledger      ALTER COLUMN usd_cost TYPE numeric(12,6);
ALTER TABLE public.tool_pricing_catalog ALTER COLUMN default_usd TYPE numeric(12,6);

-- 2) Per-user/per-tool spend rollup view
CREATE OR REPLACE VIEW public.v_user_tool_spend AS
SELECT
  user_id,
  tool_key,
  COUNT(*)::int             AS uses,
  COALESCE(SUM(tokens), 0)::int AS total_tokens,
  COALESCE(SUM(usd_cost), 0)::numeric(14,6) AS total_usd,
  MAX(created_at)           AS last_used_at,
  COALESCE(SUM(tokens) FILTER (WHERE created_at >= CURRENT_DATE), 0)::int AS tokens_today,
  COALESCE(SUM(tokens) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::int AS tokens_month,
  COALESCE(SUM(usd_cost) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::numeric(14,6) AS usd_month
FROM public.token_ledger
GROUP BY user_id, tool_key;

GRANT SELECT ON public.v_user_tool_spend TO authenticated;
GRANT SELECT ON public.v_user_tool_spend TO service_role;
