
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
     OR NEW.device_fingerprint IS DISTINCT FROM OLD.device_fingerprint
     OR NEW.device_fingerprints IS DISTINCT FROM OLD.device_fingerprints
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
