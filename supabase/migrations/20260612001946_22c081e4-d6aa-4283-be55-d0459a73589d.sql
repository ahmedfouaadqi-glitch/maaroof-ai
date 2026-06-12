
CREATE TABLE public.firecrawl_cache (
  cache_key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.firecrawl_cache TO service_role;
ALTER TABLE public.firecrawl_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read fc cache" ON public.firecrawl_cache FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
