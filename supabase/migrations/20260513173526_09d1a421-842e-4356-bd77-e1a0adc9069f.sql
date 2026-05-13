
CREATE POLICY "anyone read site_text"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key = 'site_text');
