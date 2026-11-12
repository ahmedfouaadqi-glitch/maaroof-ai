ALTER TABLE public.visibility_trial_attempts
  DROP CONSTRAINT IF EXISTS visibility_trial_attempts_status_check;
ALTER TABLE public.visibility_trial_attempts
  ADD CONSTRAINT visibility_trial_attempts_status_check
  CHECK (status IN ('reserved', 'running', 'completed', 'partial', 'failed', 'blocked', 'expired'));
