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
  IF p_device_hash IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('device:' || p_device_hash, 0)); END IF;
  IF p_session_hash IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('session:' || p_session_hash, 0)); END IF;

  SELECT * INTO v_existing FROM public.visibility_trial_attempts
  WHERE user_id = p_user_id AND request_key = p_request_key LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'existing', 'attempt_id', v_existing.id,
      'attempt_status', v_existing.status, 'result_expires_at', v_existing.result_expires_at,
      'next_eligible_at', v_existing.next_eligible_at);
  END IF;

  SELECT CASE WHEN status = 'reserved' THEN created_at + interval '10 minutes' ELSE next_eligible_at END
  INTO v_blocked_until
  FROM public.visibility_trial_attempts
  WHERE user_id = p_user_id
    AND (next_eligible_at > now() OR (status = 'reserved' AND created_at > now() - interval '10 minutes'))
  ORDER BY coalesce(next_eligible_at, created_at + interval '10 minutes') DESC LIMIT 1;
  IF v_blocked_until IS NOT NULL THEN RETURN jsonb_build_object('status', 'account_cooldown', 'retry_at', v_blocked_until); END IF;

  SELECT CASE WHEN status = 'reserved' THEN created_at + interval '10 minutes' ELSE next_eligible_at END
  INTO v_blocked_until
  FROM public.visibility_trial_attempts
  WHERE entity_fingerprint = p_entity_fingerprint
    AND (next_eligible_at > now() OR (status = 'reserved' AND created_at > now() - interval '10 minutes'))
  ORDER BY coalesce(next_eligible_at, created_at + interval '10 minutes') DESC LIMIT 1;
  IF v_blocked_until IS NOT NULL THEN RETURN jsonb_build_object('status', 'entity_cooldown', 'retry_at', v_blocked_until); END IF;

  IF p_device_hash IS NOT NULL THEN
    SELECT CASE WHEN status = 'reserved' THEN created_at + interval '10 minutes' ELSE next_eligible_at END
    INTO v_blocked_until
    FROM public.visibility_trial_attempts
    WHERE device_hash = p_device_hash AND user_id <> p_user_id
      AND (next_eligible_at > now() OR (status = 'reserved' AND created_at > now() - interval '10 minutes'))
    ORDER BY coalesce(next_eligible_at, created_at + interval '10 minutes') DESC LIMIT 1;
    IF v_blocked_until IS NOT NULL THEN RETURN jsonb_build_object('status', 'device_cooldown', 'retry_at', v_blocked_until); END IF;
  END IF;

  IF p_session_hash IS NOT NULL THEN
    SELECT CASE WHEN status = 'reserved' THEN created_at + interval '10 minutes' ELSE next_eligible_at END
    INTO v_blocked_until
    FROM public.visibility_trial_attempts
    WHERE session_hash = p_session_hash AND user_id <> p_user_id
      AND (next_eligible_at > now() OR (status = 'reserved' AND created_at > now() - interval '10 minutes'))
    ORDER BY coalesce(next_eligible_at, created_at + interval '10 minutes') DESC LIMIT 1;
    IF v_blocked_until IS NOT NULL THEN RETURN jsonb_build_object('status', 'session_cooldown', 'retry_at', v_blocked_until); END IF;
  END IF;

  IF p_ip_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('ip:' || p_ip_hash, 0));
    SELECT count(DISTINCT user_id)::integer INTO v_ip_users
    FROM public.visibility_trial_attempts
    WHERE ip_hash = p_ip_hash AND created_at > now() - interval '24 hours';
    IF coalesce(v_ip_users, 0) >= 3 THEN RETURN jsonb_build_object('status', 'ip_risk_review'); END IF;
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

