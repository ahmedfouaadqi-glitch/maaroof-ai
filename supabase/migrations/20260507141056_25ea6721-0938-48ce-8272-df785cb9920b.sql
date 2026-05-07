
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  is_subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_expires_at TIMESTAMPTZ,
  monthly_analyses_used INT NOT NULL DEFAULT 0,
  monthly_suggestions_used INT NOT NULL DEFAULT 0,
  usage_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Analyses
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  score INT,
  authority INT,
  local_relevance INT,
  citation INT,
  cached BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analyses_user ON public.analyses(user_id, created_at DESC);
CREATE INDEX idx_analyses_hash ON public.analyses(input_hash);
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Suggestions
CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  input TEXT,
  output TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suggestions_user ON public.suggestions(user_id, created_at DESC);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Analysis cache
CREATE TABLE public.analysis_cache (
  input_hash TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  result JSONB NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- Subscription plans
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_iqd INT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL DEFAULT 30,
  monthly_analyses INT NOT NULL DEFAULT 50,
  monthly_suggestions INT NOT NULL DEFAULT 30,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Subscription requests
CREATE TABLE public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  whatsapp_contacted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_req_user ON public.subscription_requests(user_id);
CREATE INDEX idx_sub_req_status ON public.subscription_requests(status);
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_user ON public.activity_log(user_id, created_at DESC);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ============= RLS POLICIES =============

-- profiles
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- analyses
CREATE POLICY "users view own analyses" ON public.analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own analyses" ON public.analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all analyses" ON public.analyses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- suggestions
CREATE POLICY "users view own suggestions" ON public.suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own suggestions" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all suggestions" ON public.suggestions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- analysis_cache (server-only via service role; no public access)
CREATE POLICY "admins view cache" ON public.analysis_cache FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- subscription_plans (publicly readable when active)
CREATE POLICY "anyone view active plans" ON public.subscription_plans FOR SELECT USING (active = true);
CREATE POLICY "admins manage plans" ON public.subscription_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- subscription_requests
CREATE POLICY "users view own requests" ON public.subscription_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users create own requests" ON public.subscription_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all requests" ON public.subscription_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update requests" ON public.subscription_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- activity_log
CREATE POLICY "users view own activity" ON public.activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all activity" ON public.activity_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Default plans
INSERT INTO public.subscription_plans (name, description, price_iqd, duration_days, monthly_analyses, monthly_suggestions, features, sort_order) VALUES
('Free', 'تجربة المنصة مع حدود يومية بسيطة', 0, 36500, 5, 3, '["تحليل GEO أساسي", "اقتراحات منشورات محدودة"]'::jsonb, 0),
('Pro Monthly', 'الباقة الاحترافية الشهرية', 25000, 30, 200, 100, '["تحليلات غير محدودة عملياً", "اقتراحات بالصور والنصوص", "سجل كامل", "أولوية الدعم"]'::jsonb, 1),
('Pro Yearly', 'الباقة الاحترافية السنوية - وفّر 20%', 240000, 365, 200, 100, '["كل مزايا Pro Monthly", "خصم 20%", "تقارير PDF"]'::jsonb, 2);
