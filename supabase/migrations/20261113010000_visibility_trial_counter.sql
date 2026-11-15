-- Public aggregate counter and server-side lifecycle records for the MAAROOF free visibility trial.
-- A run is counted only when the server transitions it from reserved to running,
-- immediately before issuing the first real engine request.

CREATE TABLE IF NOT EXISTS public.visibility_trial_stats (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_started bigint NOT NULL DEFAULT 0 CHECK (total_started >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.visibility_trial_stats (id, total_started)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.visibility_trial_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_fingerprint text NOT NULL,
  entity_name text NOT NULL,
  entity_type text NOT NULL,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'running', 'completed', 'failed', 'blocked', 'expired')),
  started_at timestamptz,
  result_expires_at timestamptz,
  next_eligible_at timestamptz,
  result_payload jsonb,
  result_view_count smallint NOT NULL DEFAULT 0 CHECK (result_view_count BETWEEN 0 AND 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visibility_trial_attempts_user_entity_created_idx
  ON public.visibility_trial_attempts (user_id, entity_fingerprint, created_at DESC);

CREATE INDEX IF NOT EXISTS visibility_trial_attempts_expiry_idx
  ON public.visibility_trial_attempts (result_expires_at)
  WHERE result_payload IS NOT NULL;

ALTER TABLE public.visibility_trial_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visibility_trial_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.visibility_trial_stats FROM anon, authenticated;
REVOKE ALL ON public.visibility_trial_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visibility_trial_stats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visibility_trial_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.mark_visibility_trial_attempt_started(p_attempt_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_id uuid;
  v_total bigint;
BEGIN
  UPDATE public.visibility_trial_attempts
  SET status = 'running',
      started_at = COALESCE(started_at, now()),
      result_expires_at = COALESCE(result_expires_at, now() + interval '72 hours'),
      next_eligible_at = COALESCE(next_eligible_at, now() + interval '77 hours'),
      updated_at = now()
  WHERE id = p_attempt_id
    AND status = 'reserved'
  RETURNING id INTO v_started_id;

  IF v_started_id IS NOT NULL THEN
    UPDATE public.visibility_trial_stats
    SET total_started = total_started + 1,
        updated_at = now()
    WHERE id = 1;
  END IF;

  SELECT total_started INTO v_total
  FROM public.visibility_trial_stats
  WHERE id = 1;

  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_visibility_trial_attempt_started(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_visibility_trial_attempt_started(uuid) TO service_role;

COMMENT ON TABLE public.visibility_trial_stats IS
  'Public-safe aggregate count of genuine free visibility trial runs. Incremented only by the server-side start transition.';
COMMENT ON TABLE public.visibility_trial_attempts IS
  'Private free visibility trial attempts. Result payload is retained for 72 hours; next eligibility is 77 hours after a real start.';
