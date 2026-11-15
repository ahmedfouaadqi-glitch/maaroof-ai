DROP POLICY IF EXISTS "signed-in users view tool plan access" ON public.tool_plan_access;
CREATE POLICY "users view own plan tool access" ON public.tool_plan_access
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN public.subscription_plans sp ON sp.name = p.subscription_tier
  WHERE p.id = auth.uid()
    AND sp.id = tool_plan_access.plan_id
    AND p.is_subscribed = true
    AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at >= now())
));