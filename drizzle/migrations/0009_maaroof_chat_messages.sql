CREATE TABLE public.maaroof_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  grounded jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.maaroof_chat_messages TO authenticated;
GRANT ALL ON public.maaroof_chat_messages TO service_role;
ALTER TABLE public.maaroof_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat read" ON public.maaroof_chat_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own chat delete" ON public.maaroof_chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX maaroof_chat_messages_user_idx ON public.maaroof_chat_messages (user_id, created_at DESC);