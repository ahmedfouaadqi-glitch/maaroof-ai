CREATE TABLE public.visibility_trial_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  visitor_id uuid,
  entity_name text,
  entity_type text,
  category text,
  description text,
  market text,
  language text,
  assets jsonb,
  status text,
  models jsonb,
  result jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.visibility_trial_archive TO authenticated;
GRANT ALL ON public.visibility_trial_archive TO service_role;
ALTER TABLE public.visibility_trial_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read trial archive" ON public.visibility_trial_archive FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX visibility_trial_archive_created_idx ON public.visibility_trial_archive (created_at DESC);