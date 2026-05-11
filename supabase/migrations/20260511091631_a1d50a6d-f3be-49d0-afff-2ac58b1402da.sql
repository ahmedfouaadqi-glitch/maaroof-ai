CREATE TABLE public.tool_plan_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  tool_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_quota INTEGER,
  daily_quota INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, tool_key)
);

CREATE INDEX idx_tool_plan_access_plan ON public.tool_plan_access(plan_id);
CREATE INDEX idx_tool_plan_access_tool ON public.tool_plan_access(tool_key);

ALTER TABLE public.tool_plan_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone view tool plan access"
  ON public.tool_plan_access FOR SELECT
  USING (true);

CREATE POLICY "admins manage tool plan access"
  ON public.tool_plan_access FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_tool_plan_access()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_tool_plan_access
BEFORE UPDATE ON public.tool_plan_access
FOR EACH ROW EXECUTE FUNCTION public.touch_tool_plan_access();