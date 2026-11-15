CREATE OR REPLACE FUNCTION public.purge_expired_visibility_trial_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- At 72h remove report/evidence and the plain-text entity label.
  -- Keep only HMAC lock signals and timestamps during the additional 5h cooldown.
  UPDATE public.visibility_trial_attempts
  SET result_payload = NULL,
      entity_name = '',
      risk_metadata = '{}'::jsonb,
      status = 'expired',
      updated_at = now()
  WHERE result_expires_at IS NOT NULL
    AND result_expires_at <= now()
    AND (result_payload IS NOT NULL OR entity_name <> '' OR risk_metadata <> '{}'::jsonb);

  -- At 77h remove the remaining lock signals and attempt row.
  DELETE FROM public.visibility_trial_attempts
  WHERE (next_eligible_at IS NOT NULL AND next_eligible_at <= now())
     OR (status = 'reserved' AND created_at <= now() - interval '10 minutes');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
