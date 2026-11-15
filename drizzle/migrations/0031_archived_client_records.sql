CREATE TABLE public.archived_client_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_label text NOT NULL,
  source_table text NOT NULL,
  source_id text,
  payload jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.archived_client_records TO authenticated;
GRANT ALL ON public.archived_client_records TO service_role;
ALTER TABLE public.archived_client_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read archived client records" ON public.archived_client_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));