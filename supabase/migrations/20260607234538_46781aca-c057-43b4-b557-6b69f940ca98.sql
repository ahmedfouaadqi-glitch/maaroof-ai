
ALTER TABLE public.publish_channels
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_account_id text,
  ADD COLUMN IF NOT EXISTS scopes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_channel_id uuid REFERENCES public.publish_channels(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  task_id uuid REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notifications" ON public.user_notifications;
CREATE POLICY "own notifications" ON public.user_notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON public.user_notifications(user_id, read_at) WHERE read_at IS NULL;
