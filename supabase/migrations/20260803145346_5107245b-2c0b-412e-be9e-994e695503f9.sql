CREATE OR REPLACE FUNCTION public.profile_privileged_fields_unchanged(
  _id uuid,
  _is_subscribed boolean,
  _subscription_tier text,
  _subscription_expires_at timestamptz,
  _tokens_balance integer,
  _tokens_monthly_limit integer,
  _tokens_daily_limit integer,
  _tokens_used_today integer,
  _tokens_used_month integer,
  _quota_overrides jsonb,
  _per_user_tool_overrides jsonb,
  _tool_geo_scopes jsonb,
  _max_devices integer,
  _extra_device_fee_iqd numeric,
  _monthly_analyses_used integer,
  _monthly_suggestions_used integer,
  _daily_analyses_used integer,
  _daily_suggestions_used integer
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _id
      AND p.is_subscribed IS NOT DISTINCT FROM _is_subscribed
      AND p.subscription_tier IS NOT DISTINCT FROM _subscription_tier
      AND p.subscription_expires_at IS NOT DISTINCT FROM _subscription_expires_at
      AND p.tokens_balance IS NOT DISTINCT FROM _tokens_balance
      AND p.tokens_monthly_limit IS NOT DISTINCT FROM _tokens_monthly_limit
      AND p.tokens_daily_limit IS NOT DISTINCT FROM _tokens_daily_limit
      AND p.tokens_used_today IS NOT DISTINCT FROM _tokens_used_today
      AND p.tokens_used_month IS NOT DISTINCT FROM _tokens_used_month
      AND p.quota_overrides IS NOT DISTINCT FROM _quota_overrides
      AND p.per_user_tool_overrides IS NOT DISTINCT FROM _per_user_tool_overrides
      AND p.tool_geo_scopes IS NOT DISTINCT FROM _tool_geo_scopes
      AND p.max_devices IS NOT DISTINCT FROM _max_devices
      AND p.extra_device_fee_iqd IS NOT DISTINCT FROM _extra_device_fee_iqd
      AND p.monthly_analyses_used IS NOT DISTINCT FROM _monthly_analyses_used
      AND p.monthly_suggestions_used IS NOT DISTINCT FROM _monthly_suggestions_used
      AND p.daily_analyses_used IS NOT DISTINCT FROM _daily_analyses_used
      AND p.daily_suggestions_used IS NOT DISTINCT FROM _daily_suggestions_used
  );
$$;
