CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone view settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "admins manage settings" ON public.app_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value)
VALUES ('agent_enabled_global', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;