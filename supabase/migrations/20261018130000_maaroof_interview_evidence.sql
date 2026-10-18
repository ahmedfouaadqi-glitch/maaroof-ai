-- External research evidence collected for a saved, completed interview.
-- Writes are service-role-only through the authenticated enrichment endpoint.
CREATE TABLE public.maaroof_interview_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.maaroof_interviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  query text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 300),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  domain text NOT NULL CHECK (char_length(domain) BETWEEN 1 AND 255),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  snippet text NOT NULL DEFAULT '' CHECK (char_length(snippet) <= 1200),
  locale text NOT NULL CHECK (locale IN ('ar','en','ku')),
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, source_url)
);

CREATE INDEX idx_maaroof_interview_evidence_interview
  ON public.maaroof_interview_evidence(interview_id, collected_at DESC);
CREATE INDEX idx_maaroof_interview_evidence_workspace
  ON public.maaroof_interview_evidence(workspace_id, collected_at DESC)
  WHERE workspace_id IS NOT NULL;

ALTER TABLE public.maaroof_interview_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maaroof_interview_evidence FROM anon, authenticated;
GRANT SELECT ON public.maaroof_interview_evidence TO authenticated;
GRANT ALL ON public.maaroof_interview_evidence TO service_role;

CREATE POLICY "maaroof_interview_evidence_read_owner_or_workspace"
  ON public.maaroof_interview_evidence
  FOR SELECT TO authenticated
  USING (
    (workspace_id IS NULL AND user_id = auth.uid())
    OR (
      workspace_id IS NOT NULL
      AND (
        public.is_workspace_member(_user_id => auth.uid(), _workspace_id => workspace_id)
        OR EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.id = workspace_id AND w.owner_id = auth.uid()
        )
      )
    )
  );
