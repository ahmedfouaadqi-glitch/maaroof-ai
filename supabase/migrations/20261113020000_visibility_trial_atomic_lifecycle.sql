-- Atomic trial reservation, report retrieval, and expiry. All decisions are made server-side.
ALTER TABLE public.visibility_trial_attempts
  ADD COLUMN IF NOT EXISTS request_key text,
  ADD COLUMN IF NOT EXISTS device_hash text,
  ADD COLUMN IF NOT EXISTS session_hash text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS report_retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS risk_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS visibility_trial_attempts_user_request_key_uq
  ON public.visibility_trial_attempts (user_id, request_key)
  WHERE request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS visibility_trial_attempts_device_idx
  ON public.visibility_trial_attempts (device_hash, created_at DESC)
  WHERE device_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS visibility_trial_attempts_session_idx
  ON public.visibility_trial_attempts (session_hash, created_at DESC)
  WHERE session_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS visibility_trial_attempts_ip_idx
  ON public.visibility_trial_attempts (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_visibility_trial_attempt(
  p_attempt_id uuid,
  p_user_id uuid,
  p_request_key text,
  p_entity_fingerprint text,
  p_entity_name text,
  p_entity_type text,
  p_device_hash text,
  p_session_hash text,
  p_ip_hash text,
  p_risk_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.visibility_trial_attempts%ROWTYPE;
  v_blocked_until timestamptz;
  v_ip_users integer;
BEGIN
  IF p_attempt_id IS NULL OR p_user_id IS NULL OR
     length(coalesce(p_request_key, '')) < 16 OR
     length(coalesce(p_entity_fingerprint, '')) < 32 OR
     length(coalesce(p_entity_name, '')) < 2 OR
     p_entity_type NOT IN ('person', 'organization', 'unknown') THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('account:' || p_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('entity:' || p_entity_fingerprint, 0));
  IF p_device_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('device:' || p_device_hash, 0));
  END IF;
  IF p_session_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('session:' || p_session_hash, 0));
  END IF;

  SELECT * INTO v_existing
  FROM public.visibility_trial_attempts
  WHERE user_id = p_user_id AND request_key = p_request_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'existing', 'attempt_id', v_existing.id,
      'attempt_status', v_existing.status, 'result_expires_at', v_existing.result_expires_at,
      'next_eligible_at', v_existing.next_eligible_at);
  END IF;

  SELECT next_eligible_at INTO v_blocked_until
  FROM public.visibility_trial_attempts
  WHERE user_id = p_user_id AND next_eligible_at > now()
  ORDER BY next_eligible_at DESC LIMIT 1;
  IF v_blocked_until IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'account_cooldown', 'retry_at', v_blocked_until);
  END IF;

  SELECT next_eligible_at INTO v_blocked_until
  FROM public.visibility_trial_attempts
  WHERE entity_fingerprint = p_entity_fingerprint AND next_eligible_at > now()
  ORDER BY next_eligible_at DESC LIMIT 1;
  IF v_blocked_until IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'entity_cooldown', 'retry_at', v_blocked_until);
  END IF;

  IF p_device_hash IS NOT NULL THEN
    SELECT next_eligible_at INTO v_blocked_until
    FROM public.visibility_trial_attempts
    WHERE device_hash = p_device_hash AND user_id <> p_user_id AND next_eligible_at > now()
    ORDER BY next_eligible_at DESC LIMIT 1;
    IF v_blocked_until IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'device_cooldown', 'retry_at', v_blocked_until);
    END IF;
  END IF;

  IF p_session_hash IS NOT NULL THEN
    SELECT next_eligible_at INTO v_blocked_until
    FROM public.visibility_trial_attempts
    WHERE session_hash = p_session_hash AND user_id <> p_user_id AND next_eligible_at > now()
    ORDER BY next_eligible_at DESC LIMIT 1;
    IF v_blocked_until IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'session_cooldown', 'retry_at', v_blocked_until);
    END IF;
  END IF;

  IF p_ip_hash IS NOT NULL THEN
    SELECT count(DISTINCT user_id)::integer INTO v_ip_users
    FROM public.visibility_trial_attempts
    WHERE ip_hash = p_ip_hash AND created_at > now() - interval '24 hours';
    IF coalesce(v_ip_users, 0) >= 3 THEN
      RETURN jsonb_build_object('status', 'ip_risk_review');
    END IF;
  END IF;

  INSERT INTO public.visibility_trial_attempts (
    id, user_id, request_key, entity_fingerprint, entity_name, entity_type,
    device_hash, session_hash, ip_hash, risk_metadata, status
  ) VALUES (
    p_attempt_id, p_user_id, p_request_key, p_entity_fingerprint, p_entity_name, p_entity_type,
    p_device_hash, p_session_hash, p_ip_hash, coalesce(p_risk_metadata, '{}'::jsonb), 'reserved'
  );

  RETURN jsonb_build_object('status', 'reserved', 'attempt_id', p_attempt_id);
END;
$$;

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

CREATE OR REPLACE FUNCTION public.complete_visibility_trial_attempt(
  p_attempt_id uuid,
  p_user_id uuid,
  p_result jsonb,
  p_status text DEFAULT 'completed'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'partial') THEN RETURN false; END IF;
  UPDATE public.visibility_trial_attempts
  SET status = p_status,
      result_payload = CASE WHEN p_status IN ('completed', 'partial') THEN p_result ELSE NULL END,
      result_view_count = CASE WHEN p_status IN ('completed', 'partial') THEN 1 ELSE 0 END,
      updated_at = now()
  WHERE id = p_attempt_id AND user_id = p_user_id AND status = 'running';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_visibility_trial_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.visibility_trial_attempts
  SET result_payload = NULL, status = 'expired', updated_at = now()
  WHERE result_payload IS NOT NULL AND result_expires_at <= now();

  DELETE FROM public.visibility_trial_attempts
  WHERE next_eligible_at IS NOT NULL AND next_eligible_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_visibility_trial_attempt(uuid,uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_visibility_trial_result(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_visibility_trial_attempt(uuid,uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_visibility_trial_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_visibility_trial_attempt(uuid,uuid,text,text,text,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_visibility_trial_result(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_visibility_trial_attempt(uuid,uuid,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_visibility_trial_data() TO service_role;
