
-- Maaroof intelligent agent tables
CREATE TABLE IF NOT EXISTS public.maaroof_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'running', -- running|done|error|aborted
  plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_geo jsonb,         -- { country, city, source }
  geo_scope jsonb,            -- { mode, country, city }
  language text DEFAULT 'ar',
  model text DEFAULT 'google/gemini-2.5-pro',
  total_tokens integer NOT NULL DEFAULT 0,
  total_usd numeric(10,6) NOT NULL DEFAULT 0,
  steps_count integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maaroof_runs TO authenticated;
GRANT ALL ON public.maaroof_runs TO service_role;
ALTER TABLE public.maaroof_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own maaroof runs" ON public.maaroof_runs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service manages maaroof runs"  ON public.maaroof_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX maaroof_runs_user_idx ON public.maaroof_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.maaroof_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.maaroof_runs(id) ON DELETE CASCADE,
  role text NOT NULL, -- user|assistant|plan|tool_call|tool_result|reflection|system
  parts jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens integer NOT NULL DEFAULT 0,
  usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.maaroof_messages TO authenticated;
GRANT ALL ON public.maaroof_messages TO service_role;
ALTER TABLE public.maaroof_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own maaroof messages" ON public.maaroof_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.maaroof_runs r WHERE r.id = run_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Service manages maaroof messages" ON public.maaroof_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX maaroof_messages_run_idx ON public.maaroof_messages(run_id, created_at);

CREATE TABLE IF NOT EXISTS public.maaroof_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.maaroof_runs(id) ON DELETE SET NULL,
  kind text NOT NULL, -- fact|preference|task_result|summary
  content text NOT NULL,
  importance integer NOT NULL DEFAULT 1, -- 1..5
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maaroof_memory TO authenticated;
GRANT ALL ON public.maaroof_memory TO service_role;
ALTER TABLE public.maaroof_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own maaroof memory" ON public.maaroof_memory FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service manages maaroof memory" ON public.maaroof_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX maaroof_memory_user_idx ON public.maaroof_memory(user_id, importance DESC, last_accessed_at DESC);
