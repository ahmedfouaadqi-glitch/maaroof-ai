
-- 1. Drop blanket public SELECT on brand_authority_packs.
-- The public crawler route uses the service-role client, so RLS doesn't apply there.
DROP POLICY IF EXISTS "anyone can read authority packs" ON public.brand_authority_packs;

-- 2. Prevent users from escalating privileged fields on their own profile.
-- Admins (via has_role) and service-role calls bypass this guard.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (no auth.uid) and admins may change anything.
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
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_updates ON public.profiles;
CREATE TRIGGER guard_profile_privileged_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_privileged_updates();
