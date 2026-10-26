CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  title text NOT NULL DEFAULT 'محادثة جديدة',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.chat_threads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX chat_threads_user_ws ON public.chat_threads(user_id, workspace_id, updated_at DESC);
ALTER TABLE public.maaroof_chat_messages ADD COLUMN IF NOT EXISTS thread_id uuid;
CREATE INDEX IF NOT EXISTS maaroof_chat_messages_thread ON public.maaroof_chat_messages(thread_id, created_at);