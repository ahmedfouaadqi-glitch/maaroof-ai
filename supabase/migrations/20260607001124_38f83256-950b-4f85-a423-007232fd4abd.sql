
-- 1) competitor_alerts
CREATE TABLE IF NOT EXISTS public.competitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watch_id uuid REFERENCES public.competitor_watch(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info',
  target text,
  message text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_alerts TO authenticated;
GRANT ALL ON public.competitor_alerts TO service_role;
ALTER TABLE public.competitor_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own competitor_alerts" ON public.competitor_alerts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_comp_alerts_user ON public.competitor_alerts(user_id, created_at DESC);

-- 2) report_templates
CREATE TABLE IF NOT EXISTS public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own report_templates" ON public.report_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_report_templates() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_report_templates_touch ON public.report_templates;
CREATE TRIGGER trg_report_templates_touch BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_report_templates();

-- 3) Emergency admin user (idempotent)
DO $$
DECLARE
  v_uid uuid;
  v_email text := 'maaroofai@geoiraq.com';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, crypt('148231200', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Maaroof Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid, v_uid::text, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());
  END IF;

  -- Ensure profile + admin role
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (v_uid, v_email, 'Maaroof Admin', 'maaroofai')
  ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
