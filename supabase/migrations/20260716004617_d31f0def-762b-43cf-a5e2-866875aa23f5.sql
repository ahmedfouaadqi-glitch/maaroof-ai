
-- Fix: admins should not be able to read raw tokens in publish_channels.config
DROP POLICY IF EXISTS "admins view all channels" ON public.publish_channels;

-- Fix: restrict maaroof_settings reads to admins only
DROP POLICY IF EXISTS "auth read maaroof_settings" ON public.maaroof_settings;
CREATE POLICY "admin read maaroof_settings"
  ON public.maaroof_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
