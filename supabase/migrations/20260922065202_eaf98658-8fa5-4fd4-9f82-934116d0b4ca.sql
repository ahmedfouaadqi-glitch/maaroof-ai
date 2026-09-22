CREATE TABLE public.user_export_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  exports_enabled BOOLEAN NOT NULL DEFAULT true,
  allowed_formats JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  show_user_name BOOLEAN,
  email_privacy TEXT,
  show_logo BOOLEAN,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_export_overrides TO authenticated;
GRANT ALL ON public.user_export_overrides TO service_role;

ALTER TABLE public.user_export_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own export override"
  ON public.user_export_overrides FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all export overrides"
  ON public.user_export_overrides FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert export overrides"
  ON public.user_export_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update export overrides"
  ON public.user_export_overrides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete export overrides"
  ON public.user_export_overrides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_user_export_overrides
  BEFORE UPDATE ON public.user_export_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();