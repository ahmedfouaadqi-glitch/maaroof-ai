-- Durable, browser-independent run records for the goal-first workspace.
-- The Worker starts work through waitUntil; these tables preserve status/events
-- so the UI can reconnect after reload or browser closure.
CREATE TABLE IF NOT EXISTS public.maaroof_background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid,
  goal text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  mode text NOT NULL DEFAULT 'execution' CHECK (mode IN ('execution','recommendation','simulation')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  current_stage text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS maaroof_background_jobs_user_recent
  ON public.maaroof_background_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS maaroof_background_jobs_active
  ON public.maaroof_background_jobs(status, created_at ASC)
  WHERE status IN ('queued','running');
ALTER TABLE public.maaroof_background_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.maaroof_background_jobs TO authenticated;
GRANT ALL ON public.maaroof_background_jobs TO service_role;
DROP POLICY IF EXISTS "maaroof background jobs owner read" ON public.maaroof_background_jobs;
CREATE POLICY "maaroof background jobs owner read" ON public.maaroof_background_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.maaroof_background_job_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.maaroof_background_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maaroof_background_job_events_job_seq
  ON public.maaroof_background_job_events(job_id, seq);
ALTER TABLE public.maaroof_background_job_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.maaroof_background_job_events TO authenticated;
GRANT ALL ON public.maaroof_background_job_events TO service_role;
DROP POLICY IF EXISTS "maaroof background events owner read" ON public.maaroof_background_job_events;
CREATE POLICY "maaroof background events owner read" ON public.maaroof_background_job_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Store only an authenticated, encrypted continuation token for queued execution.
ALTER TABLE public.maaroof_background_jobs
  ADD COLUMN IF NOT EXISTS auth_token_ciphertext text;

-- Queue dispatch is persisted before billing so a failed queue send cannot charge a run.
ALTER TABLE public.maaroof_background_jobs
  DROP CONSTRAINT IF EXISTS maaroof_background_jobs_status_check;
ALTER TABLE public.maaroof_background_jobs
  ADD CONSTRAINT maaroof_background_jobs_status_check
  CHECK (status IN ('dispatching','queued','running','completed','failed','cancelled'));
