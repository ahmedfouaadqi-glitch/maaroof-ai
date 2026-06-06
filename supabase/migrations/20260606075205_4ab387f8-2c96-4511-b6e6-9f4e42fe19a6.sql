
-- Competitor monitoring
CREATE TABLE public.competitor_watch (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  scope JSONB,
  frequency_hours INTEGER NOT NULL DEFAULT 24,
  baseline JSONB,
  last_run_at TIMESTAMPTZ,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_watch TO authenticated;
GRANT ALL ON public.competitor_watch TO service_role;
ALTER TABLE public.competitor_watch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_competitor_watch" ON public.competitor_watch FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- GEO strategies
CREATE TABLE public.geo_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  goals JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope JSONB,
  recommendations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_strategies TO authenticated;
GRANT ALL ON public.geo_strategies TO service_role;
ALTER TABLE public.geo_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_geo_strategies" ON public.geo_strategies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- What-If scenarios
CREATE TABLE public.whatif_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  projection JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatif_scenarios TO authenticated;
GRANT ALL ON public.whatif_scenarios TO service_role;
ALTER TABLE public.whatif_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_whatif" ON public.whatif_scenarios FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_competitor_watch_user ON public.competitor_watch(user_id);
CREATE INDEX idx_geo_strategies_user ON public.geo_strategies(user_id);
CREATE INDEX idx_whatif_user ON public.whatif_scenarios(user_id);
