-- AI-generated, evidence-grounded reports for completed interview sessions.
-- The authenticated API checks workspace write access and meters report generation.
CREATE TABLE public.maaroof_interview_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.maaroof_interviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'integrated' CHECK (report_type = 'integrated'),
  locale text NOT NULL CHECK (locale IN ('ar','en','ku')),
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  evidence_collected_at timestamptz,
  report_payload jsonb NOT NULL CHECK (jsonb_typeof(report_payload) = 'object'),
  model_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, report_type)
);

CREATE INDEX idx_maaroof_interview_reports_workspace
  ON public.maaroof_interview_reports(workspace_id, updated_at DESC)
  WHERE workspace_id IS NOT NULL;

ALTER TABLE public.maaroof_interview_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maaroof_interview_reports FROM anon, authenticated;
GRANT SELECT ON public.maaroof_interview_reports TO authenticated;
GRANT ALL ON public.maaroof_interview_reports TO service_role;

CREATE POLICY "maaroof_interview_reports_read_owner_or_workspace"
  ON public.maaroof_interview_reports
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
