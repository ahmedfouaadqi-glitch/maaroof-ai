-- Trial addon (3/day, 20/month, 2 targets)
INSERT INTO public.agent_addons (name, description, price_iqd, monthly_tasks, daily_task_cap, max_targets, features, active, sort_order)
VALUES ('Trial', 'وضع تجريبي مجاني — 3 مهام/يوم، 20 مهمة/شهر، هدفان', 0, 20, 3, 2, '["trial"]'::jsonb, true, -1)
ON CONFLICT (name) DO UPDATE SET
  monthly_tasks = EXCLUDED.monthly_tasks,
  daily_task_cap = EXCLUDED.daily_task_cap,
  max_targets = EXCLUDED.max_targets,
  description = EXCLUDED.description,
  active = true;

CREATE OR REPLACE FUNCTION public.ensure_trial_subscription()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing uuid;
  v_addon uuid;
  v_new uuid;
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

  SELECT id INTO v_addon FROM public.agent_addons WHERE name = 'Trial' LIMIT 1;
  IF v_addon IS NULL THEN
    RAISE EXCEPTION 'trial addon missing';
  END IF;

  INSERT INTO public.user_agent_subscriptions (user_id, addon_id, status, tasks_used, tasks_used_today, period_start)
  VALUES (v_user, v_addon, 'active', 0, 0, now())
  RETURNING id INTO v_new;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_trial_subscription() TO authenticated;