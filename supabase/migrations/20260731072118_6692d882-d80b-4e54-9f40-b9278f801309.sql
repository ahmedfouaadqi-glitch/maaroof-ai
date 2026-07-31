-- 1) Restrict anon execution of SECURITY DEFINER helper
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;

-- 2) activity_log: only self-inserts; no client updates/deletes
DROP POLICY IF EXISTS "users insert own activity" ON public.activity_log;
CREATE POLICY "users insert own activity" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3) user_notifications: no client inserts; self read/update/delete only
DROP POLICY IF EXISTS "own notifications" ON public.user_notifications;
CREATE POLICY "users read own notifications" ON public.user_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.user_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own notifications" ON public.user_notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4) hermes: consistent owner + admin policies
DROP POLICY IF EXISTS "hermes_conv_admin_all" ON public.hermes_conversations;
CREATE POLICY "hermes_conv_owner_all" ON public.hermes_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "hermes_conv_admin_read" ON public.hermes_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "hermes_msg_admin_all" ON public.hermes_messages;
CREATE POLICY "hermes_msg_owner_all" ON public.hermes_messages
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "hermes_msg_admin_read" ON public.hermes_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));