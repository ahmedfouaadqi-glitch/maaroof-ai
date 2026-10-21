CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  context text NOT NULL DEFAULT 'task',
  path text NOT NULL,
  name text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL DEFAULT 0,
  question text,
  analysis text,
  status text NOT NULL DEFAULT 'uploaded',
  tokens_charged integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments read" ON public.task_attachments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own attachments delete" ON public.task_attachments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "task files insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "task files read own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "task files delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-files' AND (storage.foldername(name))[1] = auth.uid()::text);