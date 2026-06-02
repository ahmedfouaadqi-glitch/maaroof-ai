REVOKE EXECUTE ON FUNCTION public.ensure_trial_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_trial_subscription() TO authenticated;