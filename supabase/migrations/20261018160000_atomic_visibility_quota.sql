-- Atomic visibility quota reservation.
-- This function increments quota only after locking the relevant row and re-checking limits.
CREATE OR REPLACE FUNCTION public.consume_visibility_quota(
  _user_id uuid,
  _source text,
  _profile_limit integer DEFAULT NULL,
  _subscription_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_sub public.user_agent_subscriptions%ROWTYPE;
  v_monthly_limit integer;
  v_daily_limit integer;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_daily_used integer;
BEGIN
  IF _user_id IS NULL OR _source NOT IN ('profile', 'agent_subscription') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  IF _source = 'profile' THEN
    IF _profile_limit IS NULL OR _profile_limit < 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_limit');
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = _user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
    END IF;

    IF v_profile.usage_period_start IS NULL
       OR now() - v_profile.usage_period_start > interval '30 days' THEN
      UPDATE public.profiles
      SET monthly_analyses_used = 0,
          monthly_suggestions_used = 0,
          usage_period_start = now()
      WHERE id = _user_id;
      v_profile.monthly_analyses_used := 0;
    END IF;

    IF COALESCE(v_profile.monthly_analyses_used, 0) >= _profile_limit THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'limit', 'limit', _profile_limit);
    END IF;

    UPDATE public.profiles
    SET monthly_analyses_used = COALESCE(monthly_analyses_used, 0) + 1
    WHERE id = _user_id;

    RETURN jsonb_build_object('ok', true, 'source', 'profile');
  END IF;

  IF _subscription_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_required');
  END IF;

  SELECT s.* INTO v_sub
  FROM public.user_agent_subscriptions s
  WHERE s.id = _subscription_id
    AND s.user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND OR v_sub.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_inactive');
  END IF;

  IF v_sub.expires_at IS NOT NULL AND v_sub.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_expired');
  END IF;

  SELECT a.monthly_tasks, a.daily_task_cap
  INTO v_monthly_limit, v_daily_limit
  FROM public.agent_addons a
  WHERE a.id = v_sub.addon_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'addon_not_found');
  END IF;

  IF COALESCE(v_sub.tasks_used, 0) >= v_monthly_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_cap_reached');
  END IF;

  v_daily_used := CASE
    WHEN v_sub.last_run_date = v_today THEN COALESCE(v_sub.tasks_used_today, 0)
    ELSE 0
  END;

  IF v_daily_used >= v_daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap_reached');
  END IF;

  UPDATE public.user_agent_subscriptions
  SET tasks_used = COALESCE(tasks_used, 0) + 1,
      tasks_used_today = v_daily_used + 1,
      last_run_date = v_today
  WHERE id = _subscription_id
    AND user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'source', 'agent_subscription', 'subscription_id', _subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_visibility_quota(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_visibility_quota(uuid, text, integer, uuid) TO service_role;
