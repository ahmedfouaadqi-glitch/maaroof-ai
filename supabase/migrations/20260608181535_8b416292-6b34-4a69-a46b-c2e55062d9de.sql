REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_profile_privileged_updates() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.charge_tokens(uuid, text, integer, numeric, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.charge_tokens(uuid, text, integer, numeric, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_tokens(uuid, text, integer, numeric, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_trial_subscription() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_trial_subscription() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_trial_subscription() TO authenticated, service_role;