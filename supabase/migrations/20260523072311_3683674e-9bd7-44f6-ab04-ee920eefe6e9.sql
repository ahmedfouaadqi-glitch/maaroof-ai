
-- Brand authority packs (per-user, one per brand slug)
CREATE TABLE public.brand_authority_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  brand_slug text NOT NULL UNIQUE,
  brand_name text NOT NULL,
  brand_keywords text,
  json_ld jsonb NOT NULL DEFAULT '{}'::jsonb,
  markdown text NOT NULL DEFAULT '',
  html text NOT NULL DEFAULT '',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_authority_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own authority packs"
  ON public.brand_authority_packs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins view all authority packs"
  ON public.brand_authority_packs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read access for the crawler endpoint (admin client bypasses anyway, but keep open for future)
CREATE POLICY "anyone can read authority packs"
  ON public.brand_authority_packs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER brand_authority_packs_touch
  BEFORE UPDATE ON public.brand_authority_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_tool_plan_access();

CREATE INDEX idx_brand_authority_packs_user ON public.brand_authority_packs(user_id);

-- Crawler hits log
CREATE TABLE public.crawler_hits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_slug text NOT NULL,
  user_id uuid,
  user_agent text NOT NULL,
  bot_name text,
  path text,
  ip_hash text,
  hit_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crawler_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own crawler hits"
  ON public.crawler_hits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins view all crawler hits"
  ON public.crawler_hits FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_crawler_hits_slug_time ON public.crawler_hits(brand_slug, hit_at DESC);
CREATE INDEX idx_crawler_hits_user ON public.crawler_hits(user_id, hit_at DESC);
