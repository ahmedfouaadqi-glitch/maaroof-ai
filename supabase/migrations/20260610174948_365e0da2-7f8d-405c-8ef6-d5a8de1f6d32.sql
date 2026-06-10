
-- =====================================================
-- 1) site_content — CMS for every editable string
-- =====================================================
CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  namespace text NOT NULL DEFAULT 'misc',
  ar text,
  en text,
  ku text,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_content_namespace_idx ON public.site_content(namespace);

GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_content public read"
  ON public.site_content FOR SELECT
  USING (true);

CREATE POLICY "site_content admin write"
  ON public.site_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER site_content_touch
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- 2) custom_pages — admin-created public pages
-- =====================================================
CREATE TABLE public.custom_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_ar text,
  title_en text,
  title_ku text,
  body_ar text,
  body_en text,
  body_ku text,
  meta_description_ar text,
  meta_description_en text,
  meta_description_ku text,
  published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX custom_pages_published_idx ON public.custom_pages(published) WHERE published = true;

GRANT SELECT ON public.custom_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_pages TO authenticated;
GRANT ALL ON public.custom_pages TO service_role;

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_pages public read published"
  ON public.custom_pages FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "custom_pages admin write"
  ON public.custom_pages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER custom_pages_touch
  BEFORE UPDATE ON public.custom_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- 3) report_drafts — outputs sent from tools to Report Builder
-- =====================================================
CREATE TABLE public.report_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_key text NOT NULL,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  lang text NOT NULL DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_drafts_user_idx ON public.report_drafts(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_drafts TO authenticated;
GRANT ALL ON public.report_drafts TO service_role;

ALTER TABLE public.report_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_drafts owner all"
  ON public.report_drafts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4) user_intent_profile — Cognitive layer per user
-- =====================================================
CREATE TABLE public.user_intent_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  detected_intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_summary text,
  last_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  signal_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_intent_profile TO authenticated;
GRANT ALL ON public.user_intent_profile TO service_role;

ALTER TABLE public.user_intent_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intent owner or admin read"
  ON public.user_intent_profile FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "intent admin write"
  ON public.user_intent_profile FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER user_intent_profile_touch
  BEFORE UPDATE ON public.user_intent_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
