CREATE OR REPLACE FUNCTION public.claim_visibility_trial_result(
  p_attempt_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.visibility_trial_attempts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('account:' || p_user_id::text, 0));
  SELECT * INTO v_row
  FROM public.visibility_trial_attempts
  WHERE id = p_attempt_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF v_row.status IN ('reserved', 'running') THEN
    RETURN jsonb_build_object('status', 'in_progress');
  END IF;
  IF v_row.status = 'failed' THEN RETURN jsonb_build_object('status', 'failed'); END IF;
  IF v_row.result_payload IS NULL OR v_row.result_expires_at IS NULL OR v_row.result_expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  IF v_row.result_view_count <> 1 THEN
    RETURN jsonb_build_object('status', 'retrieval_exhausted');
  END IF;

  UPDATE public.visibility_trial_attempts
  SET result_view_count = 2, report_retrieved_at = now(), updated_at = now()
  WHERE id = p_attempt_id;
  RETURN jsonb_build_object('status', 'retrieved', 'result', v_row.result_payload,
    'result_expires_at', v_row.result_expires_at);
END;
$$;
