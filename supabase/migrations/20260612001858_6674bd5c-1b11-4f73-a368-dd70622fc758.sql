
-- Firecrawl usage tracking
CREATE TABLE public.firecrawl_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tool_key text,
  op text not null check (op in ('search','scrape','map','crawl')),
  units integer not null default 1,
  query_hash text,
  cache_hit boolean not null default false,
  latency_ms integer,
  status integer,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.firecrawl_usage TO authenticated;
GRANT ALL ON public.firecrawl_usage TO service_role;
ALTER TABLE public.firecrawl_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read firecrawl usage" ON public.firecrawl_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service role manages firecrawl usage" ON public.firecrawl_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX firecrawl_usage_created_idx ON public.firecrawl_usage(created_at DESC);
CREATE INDEX firecrawl_usage_user_idx ON public.firecrawl_usage(user_id, created_at DESC);
CREATE INDEX firecrawl_usage_tool_idx ON public.firecrawl_usage(tool_key, created_at DESC);

-- Provider rate table (USD per unit, admin-managed; seeded with current Lovable AI + Firecrawl defaults)
CREATE TABLE public.provider_rates (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text,
  unit text not null,  -- 'per_1m_tokens' | 'per_credit' | 'per_call'
  usd_per_unit numeric(14,8) not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.provider_rates TO authenticated;
GRANT ALL ON public.provider_rates TO service_role;
ALTER TABLE public.provider_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone reads provider rates" ON public.provider_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write provider rates" ON public.provider_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.provider_rates (provider, model, unit, usd_per_unit, notes) VALUES
  ('lovable_ai','google/gemini-2.5-flash','per_1m_tokens',0.30,'Default input+output blended'),
  ('lovable_ai','google/gemini-2.5-pro','per_1m_tokens',5.00,'Default input+output blended'),
  ('lovable_ai','openai/gpt-5','per_1m_tokens',8.00,'Default input+output blended'),
  ('firecrawl',null,'per_credit',0.0015,'Firecrawl ~$15 / 10k credits'),
  ('semrush',null,'per_call',0.05,'Approximate per API call cost');

-- Add cognition_enabled + firecrawl_policy default app_settings entries (idempotent)
INSERT INTO public.app_settings (key, value)
VALUES
  ('cognition_enabled', '{"enabled": true}'::jsonb),
  ('firecrawl_policy', '{"global_daily": 2000, "global_monthly": 50000, "per_user_daily": 100, "per_tool": {"brand_boost": 50, "competitor_monitor": 30, "smart_research": 30, "compare": 20, "applied_ranking": 20, "company_email": 10, "social_analysis": 20, "brand_authority": 20}, "cache_ttl_hours": 24}'::jsonb)
ON CONFLICT (key) DO NOTHING;
