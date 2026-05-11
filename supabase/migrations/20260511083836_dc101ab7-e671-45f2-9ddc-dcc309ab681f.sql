-- #1 Geographic scope, #12 specialty, #3 fingerprint, daily counters
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS geo_scope jsonb NOT NULL DEFAULT '{"scope":"world"}'::jsonb,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS device_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_analyses_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_suggestions_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_day_start date NOT NULL DEFAULT CURRENT_DATE;

-- #11 Brand boost jobs (agent across AI platforms)
CREATE TABLE IF NOT EXISTS public.brand_boost_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platforms text[] NOT NULL DEFAULT ARRAY['chatgpt','gemini','claude','perplexity','copilot','grok','mistral'],
  frequency text NOT NULL DEFAULT 'weekly', -- daily|weekly|monthly
  brand_name text NOT NULL,
  brand_keywords text,
  approved boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_boost_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own boost jobs" ON public.brand_boost_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all boost jobs" ON public.brand_boost_jobs FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.brand_boost_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.brand_boost_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  report jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_boost_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own boost runs" ON public.brand_boost_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all boost runs" ON public.brand_boost_runs FOR SELECT USING (has_role(auth.uid(), 'admin'));