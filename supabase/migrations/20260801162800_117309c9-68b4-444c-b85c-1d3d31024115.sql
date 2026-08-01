-- provider_rates: admin-only reads
DROP POLICY IF EXISTS "everyone reads provider rates" ON public.provider_rates;
CREATE POLICY "Admins read provider rates"
  ON public.provider_rates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE ALL ON public.provider_rates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_rates TO authenticated;
GRANT ALL ON public.provider_rates TO service_role;

-- tool_pricing_catalog: admin-only reads
DROP POLICY IF EXISTS "anyone view pricing" ON public.tool_pricing_catalog;
CREATE POLICY "Admins read tool pricing catalog"
  ON public.tool_pricing_catalog FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE ALL ON public.tool_pricing_catalog FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_pricing_catalog TO authenticated;
GRANT ALL ON public.tool_pricing_catalog TO service_role;

-- ai_model_health: explicit no-client-write, admin read only, service_role writes
DROP POLICY IF EXISTS "No client writes to ai_model_health" ON public.ai_model_health;
CREATE POLICY "No client writes to ai_model_health"
  ON public.ai_model_health FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ai_model_health FROM anon, authenticated;
REVOKE SELECT ON public.ai_model_health FROM anon;
GRANT SELECT ON public.ai_model_health TO authenticated;
GRANT ALL ON public.ai_model_health TO service_role;