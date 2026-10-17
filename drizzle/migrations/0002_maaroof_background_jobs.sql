CREATE TABLE public.maaroof_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'execution',
  status text NOT NULL DEFAULT 'queued',
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX maaroof_jobs_user_created ON public.maaroof_jobs(user_id, created_at DESC);
CREATE TABLE public.maaroof_job_events (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.maaroof_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seq integer NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, seq)
);
GRANT SELECT ON public.maaroof_jobs TO authenticated;
GRANT ALL ON public.maaroof_jobs TO service_role;
GRANT SELECT ON public.maaroof_job_events TO authenticated;
GRANT ALL ON public.maaroof_job_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.maaroof_job_events_id_seq TO service_role;
ALTER TABLE public.maaroof_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maaroof_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs read" ON public.maaroof_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own job events read" ON public.maaroof_job_events FOR SELECT TO authenticated USING (auth.uid() = user_id);