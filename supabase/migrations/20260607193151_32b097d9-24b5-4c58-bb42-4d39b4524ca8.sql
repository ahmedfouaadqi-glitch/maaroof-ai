
-- 1) subscription_plans: tokens + usd
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_usd numeric(10,2) NOT NULL DEFAULT 0;

-- 2) tool_plan_access: per-use cost
ALTER TABLE public.tool_plan_access
  ADD COLUMN IF NOT EXISTS tokens_per_use integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_per_use numeric(10,4) NOT NULL DEFAULT 0;

-- 3) profiles: token balance + per-user overrides
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tokens_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_monthly_limit integer,
  ADD COLUMN IF NOT EXISTS tokens_daily_limit integer,
  ADD COLUMN IF NOT EXISTS tokens_used_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_used_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_user_tool_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4) token_ledger
CREATE TABLE IF NOT EXISTS public.token_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_key text NOT NULL,
  tokens integer NOT NULL,
  usd_cost numeric(10,4) NOT NULL DEFAULT 0,
  run_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON public.token_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_ledger_tool ON public.token_ledger(tool_key, created_at DESC);
GRANT SELECT ON public.token_ledger TO authenticated;
GRANT ALL ON public.token_ledger TO service_role;
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users view own ledger" ON public.token_ledger;
CREATE POLICY "users view own ledger" ON public.token_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 5) tool_pricing_catalog
CREATE TABLE IF NOT EXISTS public.tool_pricing_catalog (
  tool_key text PRIMARY KEY,
  default_tokens integer NOT NULL DEFAULT 0,
  default_usd numeric(10,4) NOT NULL DEFAULT 0,
  model text,
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tool_pricing_catalog TO authenticated, anon;
GRANT ALL ON public.tool_pricing_catalog TO service_role;
ALTER TABLE public.tool_pricing_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone view pricing" ON public.tool_pricing_catalog;
CREATE POLICY "anyone view pricing" ON public.tool_pricing_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin manage pricing" ON public.tool_pricing_catalog;
CREATE POLICY "admin manage pricing" ON public.tool_pricing_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) seed catalog
INSERT INTO public.tool_pricing_catalog (tool_key, default_tokens, default_usd, model) VALUES
  ('analyze',           1500, 0.0030, 'google/gemini-2.5-flash'),
  ('suggest',           1200, 0.0025, 'google/gemini-2.5-flash'),
  ('compare',           2500, 0.0050, 'google/gemini-2.5-pro'),
  ('feasibility',       3000, 0.0060, 'google/gemini-2.5-pro'),
  ('bizdev',            2500, 0.0050, 'google/gemini-2.5-pro'),
  ('research',          2000, 0.0040, 'google/gemini-2.5-flash'),
  ('visibility',        2000, 0.0040, 'google/gemini-2.5-flash'),
  ('brand_boost',       3000, 0.0060, 'google/gemini-2.5-pro'),
  ('company_email',     1000, 0.0020, 'google/gemini-2.5-flash'),
  ('applied_ranking',   1500, 0.0030, 'google/gemini-2.5-flash'),
  ('social',            1000, 0.0020, 'google/gemini-2.5-flash'),
  ('monitor',           2000, 0.0040, 'google/gemini-2.5-flash'),
  ('strategist',        3000, 0.0060, 'google/gemini-2.5-pro'),
  ('whatif',            2000, 0.0040, 'google/gemini-2.5-flash'),
  ('agent.command',     1500, 0.0030, 'google/gemini-2.5-flash'),
  ('agent.run_targets', 2500, 0.0050, 'google/gemini-2.5-pro'),
  ('agent.visibility',  2000, 0.0040, 'google/gemini-2.5-flash')
ON CONFLICT (tool_key) DO NOTHING;

-- 7) guard new privileged fields
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_subscribed IS DISTINCT FROM OLD.is_subscribed
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
     OR NEW.monthly_analyses_used IS DISTINCT FROM OLD.monthly_analyses_used
     OR NEW.monthly_suggestions_used IS DISTINCT FROM OLD.monthly_suggestions_used
     OR NEW.daily_analyses_used IS DISTINCT FROM OLD.daily_analyses_used
     OR NEW.daily_suggestions_used IS DISTINCT FROM OLD.daily_suggestions_used
     OR NEW.usage_period_start IS DISTINCT FROM OLD.usage_period_start
     OR NEW.usage_day_start IS DISTINCT FROM OLD.usage_day_start
     OR NEW.quota_overrides IS DISTINCT FROM OLD.quota_overrides
     OR NEW.max_devices IS DISTINCT FROM OLD.max_devices
     OR NEW.extra_device_fee_iqd IS DISTINCT FROM OLD.extra_device_fee_iqd
     OR NEW.tool_geo_scopes IS DISTINCT FROM OLD.tool_geo_scopes
     OR NEW.device_locked_at IS DISTINCT FROM OLD.device_locked_at
     OR NEW.tokens_balance IS DISTINCT FROM OLD.tokens_balance
     OR NEW.tokens_monthly_limit IS DISTINCT FROM OLD.tokens_monthly_limit
     OR NEW.tokens_daily_limit IS DISTINCT FROM OLD.tokens_daily_limit
     OR NEW.tokens_used_today IS DISTINCT FROM OLD.tokens_used_today
     OR NEW.tokens_used_month IS DISTINCT FROM OLD.tokens_used_month
     OR NEW.per_user_tool_overrides IS DISTINCT FROM OLD.per_user_tool_overrides
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

-- 8) Atomic charge function for server-side use (service role bypasses RLS anyway).
CREATE OR REPLACE FUNCTION public.charge_tokens(
  _user_id uuid, _tool_key text, _tokens integer, _usd numeric, _run_id text DEFAULT NULL, _meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_daily_left integer;
  v_monthly_left integer;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  -- Reset day/month counters if periods rolled over.
  IF v_profile.usage_day_start IS DISTINCT FROM CURRENT_DATE THEN
    UPDATE public.profiles SET tokens_used_today = 0, usage_day_start = CURRENT_DATE WHERE id = _user_id;
    v_profile.tokens_used_today := 0;
  END IF;
  IF date_trunc('month', v_profile.usage_period_start) <> date_trunc('month', now()) THEN
    UPDATE public.profiles SET tokens_used_month = 0, usage_period_start = date_trunc('month', now()) WHERE id = _user_id;
    v_profile.tokens_used_month := 0;
  END IF;

  IF v_profile.tokens_daily_limit IS NOT NULL THEN
    v_daily_left := v_profile.tokens_daily_limit - v_profile.tokens_used_today;
    IF v_daily_left < _tokens THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'daily_limit', 'left', v_daily_left);
    END IF;
  END IF;
  IF v_profile.tokens_monthly_limit IS NOT NULL THEN
    v_monthly_left := v_profile.tokens_monthly_limit - v_profile.tokens_used_month;
    IF v_monthly_left < _tokens THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'monthly_limit', 'left', v_monthly_left);
    END IF;
  END IF;
  IF v_profile.tokens_balance < _tokens THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'balance', 'left', v_profile.tokens_balance);
  END IF;

  UPDATE public.profiles
    SET tokens_balance = tokens_balance - _tokens,
        tokens_used_today = tokens_used_today + _tokens,
        tokens_used_month = tokens_used_month + _tokens
    WHERE id = _user_id;

  INSERT INTO public.token_ledger (user_id, tool_key, tokens, usd_cost, run_id, meta)
    VALUES (_user_id, _tool_key, _tokens, _usd, _run_id, _meta);

  RETURN jsonb_build_object('ok', true,
    'balance', v_profile.tokens_balance - _tokens,
    'used_today', v_profile.tokens_used_today + _tokens,
    'used_month', v_profile.tokens_used_month + _tokens);
END;
$$;

REVOKE ALL ON FUNCTION public.charge_tokens(uuid, text, integer, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_tokens(uuid, text, integer, numeric, text, jsonb) TO service_role;
