-- Run-linked, idempotent quota reservations for visibility.
-- This supersedes the untracked counter-only reservation RPC.
CREATE TABLE IF NOT EXISTS public.visibility_quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('profile', 'agent_subscription')),
  subscription_id uuid REFERENCES public.user_agent_subscriptions(id) ON DELETE CASCADE,
  profile_period_start timestamptz,
  subscription_period_start timestamptz,
  reserved_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  UNIQUE (user_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_visibility_quota_reservations_status
  ON public.visibility_quota_reservations (status, created_at);

ALTER TABLE public.visibility_quota_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visibility_quota_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visibility_quota_reservations TO service_role;

DROP FUNCTION IF EXISTS public.consume_visibility_quota(uuid, text, integer, uuid);

CREATE OR REPLACE FUNCTION public.consume_visibility_quota(
  _user_id uuid,
  _source text,
  _profile_limit integer DEFAULT NULL,
  _subscription_id uuid DEFAULT NULL,
  _run_id text DEFAULT NULL
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
  v_existing public.visibility_quota_reservations%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR _source NOT IN ('profile', 'agent_subscription')
     OR NULLIF(_run_id, '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  -- Serialize retries for this user/run before changing counters.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _run_id, 0));
  SELECT * INTO v_existing
  FROM public.visibility_quota_reservations
  WHERE user_id = _user_id AND run_id = _run_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status IN ('reserved', 'committed') THEN
      RETURN jsonb_build_object('ok', true, 'source', v_existing.source, 'reused', true, 'status', v_existing.status);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'reservation_already_released');
  END IF;

  IF _source = 'profile' THEN
    IF _profile_limit IS NULL OR _profile_limit < 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_limit');
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = _user_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
    END IF;

    IF v_profile.usage_period_start IS NULL
       OR now() - v_profile.usage_period_start > interval '30 days' THEN
      UPDATE public.profiles
      SET monthly_analyses_used = 0,
          monthly_suggestions_used = 0,
          usage_period_start = now()
      WHERE id = _user_id
      RETURNING * INTO v_profile;
    END IF;

    IF COALESCE(v_profile.monthly_analyses_used, 0) >= _profile_limit THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'limit', 'limit', _profile_limit);
    END IF;

    UPDATE public.profiles
    SET monthly_analyses_used = COALESCE(monthly_analyses_used, 0) + 1
    WHERE id = _user_id
    RETURNING * INTO v_profile;

    INSERT INTO public.visibility_quota_reservations
      (user_id, run_id, source, profile_period_start, status)
    VALUES (_user_id, _run_id, 'profile', v_profile.usage_period_start, 'reserved');

    RETURN jsonb_build_object('ok', true, 'source', 'profile', 'status', 'reserved');
  END IF;

  IF _subscription_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_required');
  END IF;

  SELECT s.* INTO v_sub
  FROM public.user_agent_subscriptions s
  WHERE s.id = _subscription_id AND s.user_id = _user_id
  FOR UPDATE;
  IF NOT FOUND OR v_sub.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_inactive');
  END IF;
  IF v_sub.expires_at IS NOT NULL AND v_sub.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_expired');
  END IF;

  IF v_sub.period_start IS NULL OR now() - v_sub.period_start > interval '30 days' THEN
    UPDATE public.user_agent_subscriptions
    SET tasks_used = 0, period_start = now()
    WHERE id = _subscription_id AND user_id = _user_id
    RETURNING * INTO v_sub;
  END IF;

  SELECT a.monthly_tasks, a.daily_task_cap INTO v_monthly_limit, v_daily_limit
  FROM public.agent_addons a WHERE a.id = v_sub.addon_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'addon_not_found');
  END IF;
  IF COALESCE(v_sub.tasks_used, 0) >= v_monthly_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_cap_reached');
  END IF;

  v_daily_used := CASE WHEN v_sub.last_run_date = v_today THEN COALESCE(v_sub.tasks_used_today, 0) ELSE 0 END;
  IF v_daily_used >= v_daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap_reached');
  END IF;

  UPDATE public.user_agent_subscriptions
  SET tasks_used = COALESCE(tasks_used, 0) + 1,
      tasks_used_today = v_daily_used + 1,
      last_run_date = v_today
  WHERE id = _subscription_id AND user_id = _user_id
  RETURNING * INTO v_sub;

  INSERT INTO public.visibility_quota_reservations
    (user_id, run_id, source, subscription_id, subscription_period_start, reserved_on, status)
  VALUES (_user_id, _run_id, 'agent_subscription', _subscription_id, v_sub.period_start, v_today, 'reserved');

  RETURN jsonb_build_object('ok', true, 'source', 'agent_subscription', 'subscription_id', _subscription_id, 'status', 'reserved');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_visibility_quota(
  _user_id uuid,
  _run_id text,
  _action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.visibility_quota_reservations%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_sub public.user_agent_subscriptions%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF _user_id IS NULL OR NULLIF(_run_id, '') IS NULL OR _action NOT IN ('commit', 'release') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _run_id, 0));
  SELECT * INTO v_res FROM public.visibility_quota_reservations
  WHERE user_id = _user_id AND run_id = _run_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reservation_not_found');
  END IF;

  IF v_res.status = _action || (v_res.status = 'committed' AND _action = 'commit') THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'status', v_res.status);
  END IF;
  IF v_res.status <> 'reserved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reservation_already_finalized', 'status', v_res.status);
  END IF;

  IF _action = 'commit' THEN
    UPDATE public.visibility_quota_reservations
    SET status = 'committed', finalized_at = now()
    WHERE id = v_res.id;
    RETURN jsonb_build_object('ok', true, 'changed', true, 'status', 'committed');
  END IF;

  IF v_res.source = 'profile' THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = _user_id FOR UPDATE;
    IF FOUND AND v_profile.usage_period_start = v_res.profile_period_start THEN
      UPDATE public.profiles
      SET monthly_analyses_used = GREATEST(0, monthly_analyses_used - 1)
      WHERE id = _user_id;
    END IF;
  ELSE
    SELECT * INTO v_sub FROM public.user_agent_subscriptions
    WHERE id = v_res.subscription_id AND user_id = _user_id FOR UPDATE;
    IF FOUND THEN
      IF v_sub.period_start = v_res.subscription_period_start THEN
        UPDATE public.user_agent_subscriptions
        SET tasks_used = GREATEST(0, tasks_used - 1)
        WHERE id = v_sub.id;
      END IF;
      IF v_sub.last_run_date = v_res.reserved_on AND v_res.reserved_on = v_today THEN
        UPDATE public.user_agent_subscriptions
        SET tasks_used_today = GREATEST(0, tasks_used_today - 1)
        WHERE id = v_sub.id;
      END IF;
    END IF;
  END IF;

  UPDATE public.visibility_quota_reservations
  SET status = 'released', finalized_at = now()
  WHERE id = v_res.id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'status', 'released');
END;
$$;

REVOKE ALL ON FUNCTION public.consume_visibility_quota(uuid, text, integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_visibility_quota(uuid, text, integer, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_visibility_quota(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_visibility_quota(uuid, text, text) TO service_role;
