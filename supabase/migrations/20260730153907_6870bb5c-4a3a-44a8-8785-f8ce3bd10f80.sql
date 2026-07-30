CREATE OR REPLACE FUNCTION public.guard_profile_privileged_inserts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.is_subscribed := false;
  NEW.subscription_tier := NULL;
  NEW.subscription_expires_at := NULL;
  NEW.monthly_analyses_used := 0;
  NEW.monthly_suggestions_used := 0;
  NEW.daily_analyses_used := 0;
  NEW.daily_suggestions_used := 0;
  NEW.quota_overrides := '{}'::jsonb;
  NEW.per_user_tool_overrides := '{}'::jsonb;
  NEW.tool_geo_scopes := '{}'::jsonb;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_inserts ON public.profiles;
CREATE TRIGGER guard_profile_privileged_inserts
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_inserts();

DROP TRIGGER IF EXISTS guard_profile_privileged_updates ON public.profiles;
CREATE TRIGGER guard_profile_privileged_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_updates();