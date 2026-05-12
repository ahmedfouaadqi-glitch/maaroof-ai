CREATE TABLE public.tool_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_tool text NOT NULL,
  target_tool text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_tool)
);
ALTER TABLE public.tool_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own tool_links" ON public.tool_links
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all tool_links" ON public.tool_links
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));