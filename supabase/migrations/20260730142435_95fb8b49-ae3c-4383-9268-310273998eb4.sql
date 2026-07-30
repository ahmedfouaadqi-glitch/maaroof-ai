-- ============ PART 14 — Executive Publishing Ecosystem ============

CREATE TABLE public.publishing_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_key TEXT NOT NULL UNIQUE,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ku TEXT,
  category TEXT NOT NULL DEFAULT 'social',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_connection BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.publishing_platforms TO authenticated;
GRANT ALL ON public.publishing_platforms TO service_role;
ALTER TABLE public.publishing_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platforms_read_authenticated" ON public.publishing_platforms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platforms_admin_manage" ON public.publishing_platforms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_publishing_platforms_touch BEFORE UPDATE ON public.publishing_platforms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.publishing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID,
  name TEXT NOT NULL,
  goal TEXT,
  brand TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  platforms TEXT[] NOT NULL DEFAULT '{}',
  strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_mode TEXT NOT NULL DEFAULT 'always_ask',
  status TEXT NOT NULL DEFAULT 'draft',
  budget_usd NUMERIC NOT NULL DEFAULT 0,
  spent_usd NUMERIC NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_user ON public.publishing_campaigns (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publishing_campaigns TO authenticated;
GRANT ALL ON public.publishing_campaigns TO service_role;
ALTER TABLE public.publishing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_own" ON public.publishing_campaigns
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_campaigns_touch BEFORE UPDATE ON public.publishing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.publishing_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID,
  platform_key TEXT NOT NULL,
  channel_id UUID,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT NOT NULL DEFAULT 'ar',
  stage TEXT NOT NULL DEFAULT 'idea',
  status TEXT NOT NULL DEFAULT 'draft',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  expert_review JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance JSONB NOT NULL DEFAULT '{}'::jsonb,
  strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_ref TEXT,
  tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_publications_user ON public.publications (user_id, created_at DESC);
CREATE INDEX idx_publications_campaign ON public.publications (campaign_id);
CREATE INDEX idx_publications_due ON public.publications (status, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publications_own" ON public.publications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_publications_touch BEFORE UPDATE ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.publication_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  ai_visibility NUMERIC,
  search_visibility NUMERIC,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pub_metrics_pub ON public.publication_metrics (publication_id, collected_at DESC);
GRANT SELECT ON public.publication_metrics TO authenticated;
GRANT ALL ON public.publication_metrics TO service_role;
ALTER TABLE public.publication_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pub_metrics_read_own" ON public.publication_metrics
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ PART 15 — Executive Trust Architecture ============

CREATE TABLE public.trust_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  user_id UUID,
  workspace_id UUID,
  trust_score NUMERIC NOT NULL DEFAULT 50,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  samples INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  contradictions INTEGER NOT NULL DEFAULT 0,
  avg_confidence NUMERIC,
  avg_cost_usd NUMERIC,
  avg_latency_ms INTEGER,
  prediction_accuracy NUMERIC,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_key, scope, user_id)
);
CREATE INDEX idx_trust_profiles_type ON public.trust_profiles (entity_type, trust_score DESC);
GRANT SELECT ON public.trust_profiles TO authenticated;
GRANT ALL ON public.trust_profiles TO service_role;
ALTER TABLE public.trust_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trust_profiles_read" ON public.trust_profiles
  FOR SELECT TO authenticated
  USING (
    (scope = 'global' AND user_id IS NULL)
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE TRIGGER trg_trust_profiles_touch BEFORE UPDATE ON public.trust_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.trust_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  user_id UUID,
  run_id UUID,
  delta NUMERIC NOT NULL DEFAULT 0,
  score_after NUMERIC,
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trust_events_entity ON public.trust_events (entity_type, entity_key, created_at DESC);
GRANT SELECT ON public.trust_events TO authenticated;
GRANT ALL ON public.trust_events TO service_role;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trust_events_read" ON public.trust_events
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Seed the platform catalog (extensible: new rows only, no schema change).
INSERT INTO public.publishing_platforms (platform_key, label_ar, label_en, label_ku, category, sort_order, requires_connection, profile, limits) VALUES
 ('facebook','فيسبوك','Facebook','فەیسبووک','social',10,true,'{"audience":"عام واسع","best_types":["صور","فيديو قصير","منشور نصي"],"best_time":"19:00-22:00","frequency":"1-2/يوم","hashtags":"2-3","cta":"سؤال مباشر"}','{"text":63206,"media":10}'),
 ('instagram','إنستغرام','Instagram','ئینستاگرام','social',20,true,'{"audience":"بصري شاب","best_types":["ريلز","كاروسيل"],"best_time":"20:00-23:00","frequency":"1/يوم","hashtags":"8-15","cta":"احفظ/شارك"}','{"text":2200,"media":10}'),
 ('threads','ثريدز','Threads','ثردز','social',30,true,'{"audience":"نقاشي","best_types":["نص قصير"],"best_time":"12:00-15:00","frequency":"2-4/يوم","hashtags":"1","cta":"رأيك؟"}','{"text":500,"media":10}'),
 ('linkedin','لينكدإن','LinkedIn','لینکدئین','professional',40,true,'{"audience":"مهني وقرار شرائي","best_types":["مقال","دراسة حالة"],"best_time":"08:00-11:00","frequency":"3-5/أسبوع","hashtags":"3-5","cta":"تحميل/تواصل"}','{"text":3000,"media":9}'),
 ('x','إكس','X','ئێکس','social',50,true,'{"audience":"أخبار وسرعة","best_types":["سلسلة تغريدات"],"best_time":"09:00-12:00","frequency":"3-8/يوم","hashtags":"1-2","cta":"رابط"}','{"text":280,"media":4}'),
 ('tiktok','تيك توك','TikTok','تیک تۆک','video',60,true,'{"audience":"شاب جداً","best_types":["فيديو عمودي 15-45ث"],"best_time":"18:00-23:00","frequency":"1-3/يوم","hashtags":"3-5","cta":"تابع"}','{"text":2200,"media":1}'),
 ('youtube','يوتيوب','YouTube','یوتیوب','video',70,true,'{"audience":"بحث طويل الأمد","best_types":["شروحات","شورتس"],"best_time":"عطلة نهاية الأسبوع","frequency":"1-2/أسبوع","hashtags":"3","cta":"اشترك"}','{"text":5000,"media":1}'),
 ('pinterest','بينترست','Pinterest','پینتەرێست','social',80,true,'{"audience":"نية شرائية","best_types":["صور عمودية"],"best_time":"20:00-23:00","frequency":"3-5/يوم","hashtags":"3-5","cta":"زر الموقع"}','{"text":500,"media":1}'),
 ('telegram','تيليجرام','Telegram','تێلێگرام','messaging',90,true,'{"audience":"مجتمع مباشر","best_types":["نص + رابط"],"best_time":"مرن","frequency":"1-3/يوم","hashtags":"0","cta":"رابط مباشر"}','{"text":4096,"media":10}'),
 ('whatsapp','واتساب للأعمال','WhatsApp Business','واتساپ','messaging',100,true,'{"audience":"عملاء حاليون","best_types":["إعلان قصير"],"best_time":"10:00-20:00","frequency":"2-4/أسبوع","hashtags":"0","cta":"رد سريع"}','{"text":4096,"media":1}'),
 ('google_business','ملف الأعمال في جوجل','Google Business Profile','پرۆفایلی گووگڵ','local',110,true,'{"audience":"بحث محلي","best_types":["تحديث","عرض"],"best_time":"صباحاً","frequency":"2/أسبوع","hashtags":"0","cta":"اتصال/اتجاهات"}','{"text":1500,"media":10}'),
 ('wordpress','ووردبريس','WordPress','وۆردپرێس','blog',120,true,'{"audience":"بحث عضوي","best_types":["مقال طويل"],"best_time":"مرن","frequency":"1-2/أسبوع","hashtags":"0","cta":"اشتراك"}','{"text":100000,"media":50}'),
 ('medium','ميديوم','Medium','میدیۆم','blog',130,true,'{"audience":"قرّاء تقنيون","best_types":["مقال رأي"],"best_time":"مرن","frequency":"1/أسبوع","hashtags":"5","cta":"متابعة"}','{"text":100000,"media":30}'),
 ('ghost','غوست','Ghost','گۆست','blog',140,true,'{"audience":"نشرة بريدية","best_types":["مقال + نشرة"],"best_time":"مرن","frequency":"1/أسبوع","hashtags":"0","cta":"اشتراك"}','{"text":100000,"media":30}'),
 ('blogger','بلوجر','Blogger','بلۆگەر','blog',150,true,'{"audience":"بحث عضوي","best_types":["مقال"],"best_time":"مرن","frequency":"1/أسبوع","hashtags":"0","cta":"قراءة المزيد"}','{"text":100000,"media":20}'),
 ('reddit','ريديت','Reddit','ڕێدیت','community',160,true,'{"audience":"مجتمعات متخصصة","best_types":["نقاش بلا ترويج"],"best_time":"14:00-18:00","frequency":"2-3/أسبوع","hashtags":"0","cta":"سؤال"}','{"text":40000,"media":20}'),
 ('discord','ديسكورد','Discord','دیسکۆرد','community',170,true,'{"audience":"مجتمع مغلق","best_types":["إعلان مجتمعي"],"best_time":"مساءً","frequency":"يومي","hashtags":"0","cta":"انضم"}','{"text":2000,"media":10}'),
 ('slack','سلاك','Slack','سلاک','community',180,true,'{"audience":"فرق عمل","best_types":["تحديث داخلي"],"best_time":"ساعات العمل","frequency":"يومي","hashtags":"0","cta":"مراجعة"}','{"text":4000,"media":10}'),
 ('email','حملات بريدية','Email Campaigns','کەمپینی ئیمەیل','email',190,true,'{"audience":"قائمة مملوكة","best_types":["نشرة"],"best_time":"ثلاثاء 09:00","frequency":"1/أسبوع","hashtags":"0","cta":"زر واحد"}','{"text":100000,"media":20}'),
 ('rss','RSS','RSS','RSS','feed',200,false,'{"audience":"مجمّعات المحتوى","best_types":["ملخص"],"best_time":"فوري","frequency":"مع كل نشر","hashtags":"0","cta":"رابط"}','{"text":100000,"media":5}'),
 ('webhook','ويب هوك','Webhook','وێبهوک','integration',210,true,'{"audience":"أنظمة خارجية","best_types":["JSON"],"best_time":"فوري","frequency":"مع كل حدث","hashtags":"0","cta":"—"}','{"text":100000,"media":0}'),
 ('mcp','مزوّد MCP','MCP Provider','دابینکەری MCP','integration',220,true,'{"audience":"قدرات خارجية","best_types":["استدعاء قدرة"],"best_time":"فوري","frequency":"حسب الحاجة","hashtags":"0","cta":"—"}','{"text":100000,"media":0}');
