DROP POLICY IF EXISTS "anyone view settings" ON public.app_settings;
CREATE POLICY "authenticated view settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "users access own realtime topics" ON realtime.messages;
CREATE POLICY "users access own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic())::text LIKE (auth.uid())::text || '%'
);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_tool_plan_access() FROM anon, authenticated, public;
