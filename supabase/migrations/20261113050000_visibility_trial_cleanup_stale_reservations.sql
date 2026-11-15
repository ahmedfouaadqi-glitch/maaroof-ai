CREATE OR REPLACE FUNCTION public.purge_expired_visibility_trial_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  UPDATE public.visibility_trial_attempts
  SET result_payload = NULL, status = 'expired', updated_at = now()
  WHERE result_payload IS NOT NULL AND result_expires_at <= now();

  DELETE FROM public.visibility_trial_attempts
  WHERE (next_eligible_at IS NOT NULL AND next_eligible_at <= now())
     OR (status = 'reserved' AND created_at <= now() - interval '10 minutes');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
