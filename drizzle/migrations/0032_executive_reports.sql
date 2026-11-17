CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  tool_key text,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'client' CHECK (kind IN ('client','technical')),
  status text NOT NULL DEFAULT 'Generated',
  version integer NOT NULL DEFAULT 1,
  lang text NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar','en','ku')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspace reports read" ON public.reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "own workspace reports insert" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "own workspace reports update" ON public.reports FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX reports_ws_idx ON public.reports(workspace_id, updated_at DESC);
CREATE TRIGGER reports_touch BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.report_branding (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  company_name text,
  logo_url text,
  brand_color text,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.report_branding TO authenticated;
GRANT ALL ON public.report_branding TO service_role;
ALTER TABLE public.report_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own branding read" ON public.report_branding FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "own branding insert" ON public.report_branding FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "own branding update" ON public.report_branding FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER report_branding_touch BEFORE UPDATE ON public.report_branding FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.report_share_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.report_share_grants TO authenticated;
GRANT ALL ON public.report_share_grants TO service_role;
ALTER TABLE public.report_share_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grants read" ON public.report_share_grants FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own grants insert" ON public.report_share_grants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.user_id = auth.uid() AND r.kind = 'client'));
CREATE POLICY "own grants update" ON public.report_share_grants FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_shared_report(_token_hash text)
RETURNS TABLE(title text, lang text, html text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.title, r.lang, r.html
  FROM public.report_share_grants g JOIN public.reports r ON r.id = g.report_id
  WHERE g.token_hash = _token_hash AND g.revoked_at IS NULL AND g.expires_at > now() AND r.kind = 'client'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_shared_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_report(text) TO anon, authenticated;