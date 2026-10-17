-- General-purpose Maaroof interview sessions.
-- Writes go through /api/maaroof-interviews, which verifies caller and workspace role.
-- Authenticated clients have read-only RLS access; no Cloudflare resources are used.

CREATE TABLE public.maaroof_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (
    target_type IN ('individual','creator','company','agency','client','brand','project','task')
  ),
  target_name text NOT NULL CHECK (char_length(trim(target_name)) BETWEEN 1 AND 200),
  initial_goal text CHECK (initial_goal IS NULL OR char_length(initial_goal) <= 2000),
  domains text[] NOT NULL DEFAULT ARRAY['general']::text[]
    CHECK (
      cardinality(domains) BETWEEN 1 AND 5
      AND domains <@ ARRAY['general','seo','aeo','geo','gseo']::text[]
    ),
  locale text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar','en','ku')),
  question_set_version text NOT NULL,
  questions_snapshot jsonb NOT NULL CHECK (jsonb_typeof(questions_snapshot) = 'array'),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','paused','completed','abandoned')),
  current_question_id text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT maaroof_interviews_completed_status_consistent
    CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL))
);

CREATE INDEX idx_maaroof_interviews_user_updated
  ON public.maaroof_interviews(user_id, updated_at DESC);
CREATE INDEX idx_maaroof_interviews_workspace_updated
  ON public.maaroof_interviews(workspace_id, updated_at DESC)
  WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_maaroof_interviews_status_updated
  ON public.maaroof_interviews(status, updated_at DESC);

ALTER TABLE public.maaroof_interviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maaroof_interviews FROM anon, authenticated;
GRANT SELECT ON public.maaroof_interviews TO authenticated;
GRANT ALL ON public.maaroof_interviews TO service_role;

CREATE POLICY "maaroof_interviews_read_owner_or_workspace"
  ON public.maaroof_interviews
  FOR SELECT TO authenticated
  USING (
    (workspace_id IS NULL AND user_id = auth.uid())
    OR (
      workspace_id IS NOT NULL
      AND (
        public.is_workspace_member(workspace_id, auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.workspaces w
          WHERE w.id = workspace_id AND w.owner_id = auth.uid()
        )
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER maaroof_interviews_touch
  BEFORE UPDATE ON public.maaroof_interviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.maaroof_interviews IS
  'Cross-workflow interviews. Writes use the authenticated server API with role checks and optimistic version control.';
