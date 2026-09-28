CREATE TABLE public.mci_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_key text NOT NULL,
  intent text,
  decision text NOT NULL,
  reused_run_id uuid,
  llm_calls int NOT NULL DEFAULT 0,
  llm_calls_saved int NOT NULL DEFAULT 0,
  firecrawl_calls int NOT NULL DEFAULT 0,
  firecrawl_calls_saved int NOT NULL DEFAULT 0,
  fallback boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mci_decisions TO authenticated;
GRANT ALL ON public.mci_decisions TO service_role;
ALTER TABLE public.mci_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mci own or admin read" ON public.mci_decisions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX mci_decisions_tool_created ON public.mci_decisions (tool_key, created_at DESC);

CREATE TABLE public.engine_answer_cache (
  cache_key text PRIMARY KEY,
  engine text NOT NULL,
  answer jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.engine_answer_cache TO service_role;
ALTER TABLE public.engine_answer_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eac admin read" ON public.engine_answer_cache FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));