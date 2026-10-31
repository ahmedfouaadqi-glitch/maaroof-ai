DROP POLICY IF EXISTS "anyone view tool plan access" ON public.tool_plan_access;
CREATE POLICY "signed-in users view tool plan access" ON public.tool_plan_access FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.tool_plan_access FROM anon;