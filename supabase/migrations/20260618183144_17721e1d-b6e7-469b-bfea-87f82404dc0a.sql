CREATE TABLE IF NOT EXISTS public.maaroof_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.maaroof_settings TO authenticated;
GRANT ALL ON public.maaroof_settings TO service_role;

ALTER TABLE public.maaroof_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read maaroof_settings" ON public.maaroof_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin insert maaroof_settings" ON public.maaroof_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update maaroof_settings" ON public.maaroof_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete maaroof_settings" ON public.maaroof_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.maaroof_settings (key, value) VALUES
  ('trial_daily_cap', '5'::jsonb),
  ('tool_timeout_ms', '45000'::jsonb),
  ('max_steps', '12'::jsonb),
  ('max_goal_chars', '2000'::jsonb),
  ('planner_model', '"google/gemini-2.5-pro"'::jsonb),
  ('fallback_model', '"google/gemini-2.5-flash"'::jsonb),
  ('enabled_tools', '["suggest","geo_rewrite","analyze","research","feasibility","bizdev","brand-boost","what-if","applied-ranking","visibility","social-analysis"]'::jsonb),
  ('system_prompt_extra', '""'::jsonb),
  ('kill_switch', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;