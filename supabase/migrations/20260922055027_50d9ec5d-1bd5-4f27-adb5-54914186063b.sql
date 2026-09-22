-- 1) Free plan / new-account policy (single admin-controlled row)
INSERT INTO public.app_settings (key, value)
VALUES ('free_plan_policy', jsonb_build_object(
  'trial_enabled', true,
  'require_email_verified', true,
  'initial_tokens', 0,
  'tokens_daily_limit', null,
  'tokens_monthly_limit', null,
  'maaroof_daily_sessions', 5
))
ON CONFLICT (key) DO NOTHING;

-- 2) New accounts default to automatic geo detection
ALTER TABLE public.profiles ALTER COLUMN geo_scope SET DEFAULT '{"scope":"auto"}'::jsonb;

-- 3) Trial provisioning now obeys the policy
CREATE OR REPLACE FUNCTION public.ensure_trial_subscription()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_existing uuid;
  v_addon uuid;
  v_new uuid;
  v_policy jsonb;
  v_confirmed timestamptz;
  v_initial int;
  v_daily int;
  v_monthly int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT id INTO v_existing
  FROM public.user_agent_subscriptions
  WHERE user_id = v_user AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT value INTO v_policy FROM public.app_settings WHERE key = 'free_plan_policy';
  v_policy := COALESCE(v_policy, '{}'::jsonb);

  -- Admin switch: no automatic trial at all.
  IF COALESCE((v_policy->>'trial_enabled')::boolean, true) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  -- Optional email confirmation requirement.
  IF COALESCE((v_policy->>'require_email_verified')::boolean, true) THEN
    SELECT email_confirmed_at INTO v_confirmed FROM auth.users WHERE id = v_user;
    IF v_confirmed IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT id INTO v_addon FROM public.agent_addons WHERE name = 'Trial' LIMIT 1;
  IF v_addon IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_agent_subscriptions (user_id, addon_id, status, tasks_used, tasks_used_today, period_start)
  VALUES (v_user, v_addon, 'active', 0, 0, now())
  RETURNING id INTO v_new;

  -- Apply the configured starting balance / caps (only once, when balance is still 0).
  v_initial := COALESCE((v_policy->>'initial_tokens')::int, 0);
  v_daily := NULLIF(v_policy->>'tokens_daily_limit', '')::int;
  v_monthly := NULLIF(v_policy->>'tokens_monthly_limit', '')::int;

  IF v_initial > 0 OR v_daily IS NOT NULL OR v_monthly IS NOT NULL THEN
    UPDATE public.profiles p
      SET tokens_balance = CASE WHEN v_initial > 0 AND COALESCE(p.tokens_balance, 0) = 0 THEN v_initial ELSE p.tokens_balance END,
          tokens_daily_limit = COALESCE(v_daily, p.tokens_daily_limit),
          tokens_monthly_limit = COALESCE(v_monthly, p.tokens_monthly_limit)
      WHERE p.id = v_user;
  END IF;

  RETURN v_new;
END;
$function$;
