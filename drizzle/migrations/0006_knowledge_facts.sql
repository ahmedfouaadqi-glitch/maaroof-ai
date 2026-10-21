CREATE TABLE public.knowledge_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_ref text,
  fact text NOT NULL,
  confidence text NOT NULL DEFAULT 'evidence',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.knowledge_facts TO authenticated;
GRANT ALL ON public.knowledge_facts TO service_role;
ALTER TABLE public.knowledge_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own facts read" ON public.knowledge_facts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own facts delete" ON public.knowledge_facts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX knowledge_facts_user_idx ON public.knowledge_facts(user_id, created_at DESC);