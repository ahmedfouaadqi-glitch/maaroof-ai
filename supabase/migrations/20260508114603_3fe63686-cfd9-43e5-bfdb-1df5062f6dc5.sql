
-- AGENT ADD-ON SYSTEM
CREATE TABLE public.agent_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_iqd INTEGER NOT NULL DEFAULT 0,
  monthly_tasks INTEGER NOT NULL DEFAULT 50,
  daily_task_cap INTEGER NOT NULL DEFAULT 10,
  max_targets INTEGER NOT NULL DEFAULT 1,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view active addons" ON public.agent_addons FOR SELECT USING (active = true);
CREATE POLICY "admins manage addons" ON public.agent_addons FOR ALL USING (has_role(auth.uid(),'admin'));

CREATE TABLE public.user_agent_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  addon_id UUID REFERENCES public.agent_addons(id),
  status TEXT NOT NULL DEFAULT 'pending',
  tasks_used INTEGER NOT NULL DEFAULT 0,
  tasks_used_today INTEGER NOT NULL DEFAULT 0,
  last_run_date DATE,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_agent_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own agent sub" ON public.user_agent_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage agent subs" ON public.user_agent_subscriptions FOR ALL USING (has_role(auth.uid(),'admin'));

CREATE TABLE public.agent_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT,
  topic TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own targets" ON public.agent_targets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all targets" ON public.agent_targets FOR SELECT USING (has_role(auth.uid(),'admin'));

CREATE TABLE public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_id UUID REFERENCES public.agent_targets(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  input TEXT,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own tasks" ON public.agent_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all tasks" ON public.agent_tasks FOR SELECT USING (has_role(auth.uid(),'admin'));

-- Extend subscription_requests to track addon type
ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'plan';
ALTER TABLE public.subscription_requests ADD COLUMN IF NOT EXISTS agent_addon_id UUID REFERENCES public.agent_addons(id);

-- Seed addons
INSERT INTO public.agent_addons (name, description, price_iqd, monthly_tasks, daily_task_cap, max_targets, features, sort_order) VALUES
('Agent Lite','وكيل خفيف لمراقبة موقع واحد', 20000, 50, 5, 1,
 '["تحليل GEO أسبوعي تلقائي","اقتراح منشور أسبوعي","تقرير شهري","موقع/صفحة واحدة"]'::jsonb, 1),
('Agent Pro','أتمتة كاملة لـ3 مواقع', 50000, 200, 10, 3,
 '["تحليل يومي تلقائي","اقتراحات منشورات استباقية","حتى 3 مواقع","تقارير أسبوعية مفصّلة","تنبيهات بفرص الظهور"]'::jsonb, 2),
('Agent Business','للوكالات وفِرق المحتوى', 120000, 800, 30, 10,
 '["حتى 10 مواقع","تحليل + اقتراح يومي لكل موقع","تقارير PDF آلية","API للوصول الخارجي","أولوية في المعالجة"]'::jsonb, 3);
