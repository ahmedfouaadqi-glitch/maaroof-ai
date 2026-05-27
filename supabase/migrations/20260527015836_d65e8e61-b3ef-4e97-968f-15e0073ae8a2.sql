
-- Governorates
CREATE TABLE public.governorates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  name_ku text NOT NULL,
  lat double precision,
  lng double precision,
  population_base integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.governorates TO anon, authenticated;
GRANT ALL ON public.governorates TO service_role;
ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read governorates" ON public.governorates FOR SELECT USING (true);
CREATE POLICY "admins manage governorates" ON public.governorates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Pulse Sources
CREATE TABLE public.pulse_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  url text NOT NULL,
  scrape_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pulse_sources TO anon, authenticated;
GRANT ALL ON public.pulse_sources TO service_role;
ALTER TABLE public.pulse_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read sources" ON public.pulse_sources FOR SELECT USING (true);
CREATE POLICY "admins manage sources" ON public.pulse_sources FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Raw snapshots
CREATE TABLE public.pulse_raw_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.pulse_sources(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  url text
);
CREATE INDEX idx_pulse_raw_source_time ON public.pulse_raw_snapshots(source_id, fetched_at DESC);
GRANT SELECT ON public.pulse_raw_snapshots TO authenticated;
GRANT ALL ON public.pulse_raw_snapshots TO service_role;
ALTER TABLE public.pulse_raw_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read raw" ON public.pulse_raw_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Normalized metrics
CREATE TABLE public.pulse_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate_id uuid REFERENCES public.governorates(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.pulse_sources(id) ON DELETE SET NULL,
  metric_key text NOT NULL,
  sector text NOT NULL DEFAULT 'general',
  value numeric,
  unit text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pulse_metrics_gov_key ON public.pulse_metrics(governorate_id, metric_key, captured_at DESC);
CREATE INDEX idx_pulse_metrics_sector ON public.pulse_metrics(sector, captured_at DESC);
GRANT SELECT ON public.pulse_metrics TO anon, authenticated;
GRANT ALL ON public.pulse_metrics TO service_role;
ALTER TABLE public.pulse_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read metrics" ON public.pulse_metrics FOR SELECT USING (true);

-- Trending apps (national + per governorate)
CREATE TABLE public.pulse_trending_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate_id uuid REFERENCES public.governorates(id) ON DELETE CASCADE,
  app_name text NOT NULL,
  category text,
  rank integer NOT NULL,
  score numeric,
  source_id uuid REFERENCES public.pulse_sources(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trending_apps_gov_rank ON public.pulse_trending_apps(governorate_id, rank, captured_at DESC);
GRANT SELECT ON public.pulse_trending_apps TO anon, authenticated;
GRANT ALL ON public.pulse_trending_apps TO service_role;
ALTER TABLE public.pulse_trending_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read trending apps" ON public.pulse_trending_apps FOR SELECT USING (true);

-- Scrape log
CREATE TABLE public.pulse_scrape_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.pulse_sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  rows_inserted integer DEFAULT 0,
  error text
);
CREATE INDEX idx_scrape_log_started ON public.pulse_scrape_log(started_at DESC);
GRANT SELECT ON public.pulse_scrape_log TO authenticated;
GRANT ALL ON public.pulse_scrape_log TO service_role;
ALTER TABLE public.pulse_scrape_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read scrape log" ON public.pulse_scrape_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- User behavior
CREATE TABLE public.pulse_user_behavior (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  governorate_id uuid REFERENCES public.governorates(id) ON DELETE SET NULL,
  metric_key text,
  sector text,
  action text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_behavior_user_time ON public.pulse_user_behavior(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.pulse_user_behavior TO authenticated;
GRANT ALL ON public.pulse_user_behavior TO service_role;
ALTER TABLE public.pulse_user_behavior ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert own behavior" ON public.pulse_user_behavior FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users read own behavior" ON public.pulse_user_behavior FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "admins read all behavior" ON public.pulse_user_behavior FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Specialty weights
CREATE TABLE public.pulse_specialty_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty text NOT NULL,
  sector text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  UNIQUE (specialty, sector)
);
GRANT SELECT ON public.pulse_specialty_weights TO anon, authenticated;
GRANT ALL ON public.pulse_specialty_weights TO service_role;
ALTER TABLE public.pulse_specialty_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read weights" ON public.pulse_specialty_weights FOR SELECT USING (true);
CREATE POLICY "admins manage weights" ON public.pulse_specialty_weights FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- App config
CREATE TABLE public.pulse_app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.pulse_app_config TO anon, authenticated;
GRANT ALL ON public.pulse_app_config TO service_role;
ALTER TABLE public.pulse_app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read app config" ON public.pulse_app_config FOR SELECT USING (true);
CREATE POLICY "admins manage app config" ON public.pulse_app_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed 18 governorates
INSERT INTO public.governorates (slug, name_ar, name_en, name_ku, lat, lng, population_base) VALUES
  ('baghdad', 'بغداد', 'Baghdad', 'بەغدا', 33.3152, 44.3661, 8126755),
  ('basra', 'البصرة', 'Basra', 'بەسرە', 30.5085, 47.7804, 3055514),
  ('nineveh', 'نينوى', 'Nineveh', 'نەینەوا', 36.3489, 43.1577, 4226747),
  ('erbil', 'أربيل', 'Erbil', 'ھەولێر', 36.1911, 44.0094, 2113391),
  ('sulaymaniyah', 'السليمانية', 'Sulaymaniyah', 'سلێمانی', 35.5556, 45.4351, 2244957),
  ('duhok', 'دهوك', 'Duhok', 'دھۆک', 36.8669, 42.9484, 1383037),
  ('kirkuk', 'كركوك', 'Kirkuk', 'کەرکووک', 35.4681, 44.3922, 1731000),
  ('anbar', 'الأنبار', 'Al-Anbar', 'ئەنبار', 33.4258, 43.3032, 1879859),
  ('babil', 'بابل', 'Babil', 'بابل', 32.4733, 44.4307, 2065042),
  ('karbala', 'كربلاء', 'Karbala', 'کەربەلا', 32.6160, 44.0244, 1320700),
  ('najaf', 'النجف', 'Najaf', 'نەجەف', 32.0001, 44.3354, 1592873),
  ('wasit', 'واسط', 'Wasit', 'واست', 32.5074, 45.8264, 1390480),
  ('diyala', 'ديالى', 'Diyala', 'دیالە', 33.7717, 44.6166, 1773190),
  ('saladin', 'صلاح الدين', 'Saladin', 'سەلاحەدین', 34.5950, 43.6850, 1670400),
  ('qadisiyyah', 'القادسية', 'Al-Qadisiyyah', 'قادسیە', 31.9889, 44.9214, 1369000),
  ('muthanna', 'المثنى', 'Al-Muthanna', 'موسەننا', 31.3151, 45.2747, 859000),
  ('dhi-qar', 'ذي قار', 'Dhi Qar', 'زیقار', 31.0421, 46.2667, 2186000),
  ('maysan', 'ميسان', 'Maysan', 'مەیسان', 31.8331, 47.1444, 1148000);

-- Seed pulse sources (9 data + 1 trending apps)
INSERT INTO public.pulse_sources (key, name_ar, name_en, url, scrape_config) VALUES
  ('cosit', 'الجهاز المركزي للإحصاء', 'COSIT', 'https://cosit.gov.iq', '{"formats":["markdown"],"kind":"html"}'::jsonb),
  ('cmc', 'هيئة الاتصالات والإعلام', 'CMC Iraq', 'https://www.cmc.iq', '{"formats":["markdown"],"kind":"html"}'::jsonb),
  ('isx', 'سوق العراق للأوراق المالية', 'Iraq Stock Exchange', 'http://www.isx-iq.net', '{"formats":["markdown"],"kind":"html"}'::jsonb),
  ('google_trends', 'مؤشرات بحث جوجل', 'Google Trends Iraq', 'https://trends.google.com/trends/explore?geo=IQ', '{"formats":["markdown"],"kind":"trends"}'::jsonb),
  ('hdx', 'بيانات HDX المفتوحة', 'HDX Iraq', 'https://data.humdata.org/group/irq', '{"formats":["markdown"],"kind":"hdx"}'::jsonb),
  ('iom_dtm', 'منظمة الهجرة الدولية DTM', 'IOM DTM Iraq', 'https://dtm.iom.int/iraq', '{"formats":["markdown"],"kind":"html"}'::jsonb),
  ('world_bank', 'البنك الدولي - العراق', 'World Bank Iraq', 'https://api.worldbank.org/v2/country/IRQ/indicator', '{"kind":"api"}'::jsonb),
  ('cbi', 'البنك المركزي العراقي', 'Central Bank of Iraq', 'https://cbi.iq', '{"formats":["markdown"],"kind":"html"}'::jsonb),
  ('mop', 'وزارة التخطيط', 'Ministry of Planning', 'https://mop.gov.iq', '{"formats":["markdown"],"kind":"html"}'::jsonb),
  ('trending_apps', 'التطبيقات الأكثر تداولاً', 'Trending Apps Iraq', 'https://www.similarweb.com/top-apps/google/iraq/', '{"formats":["markdown"],"kind":"trending_apps"}'::jsonb);

-- Seed specialty weights
INSERT INTO public.pulse_specialty_weights (specialty, sector, weight) VALUES
  ('real_estate', 'population', 1.5), ('real_estate', 'construction', 2.0), ('real_estate', 'prices', 1.8), ('real_estate', 'general', 0.8),
  ('doctor', 'population', 1.8), ('doctor', 'health', 2.0), ('doctor', 'demographics', 1.5), ('doctor', 'general', 0.8),
  ('trader', 'isx', 2.0), ('trader', 'currency', 1.8), ('trader', 'prices', 1.6), ('trader', 'trade', 1.5), ('trader', 'general', 0.8),
  ('engineer', 'construction', 1.8), ('engineer', 'infrastructure', 2.0), ('engineer', 'energy', 1.5), ('engineer', 'general', 0.8),
  ('marketer', 'apps', 2.0), ('marketer', 'search_trends', 1.8), ('marketer', 'population', 1.4), ('marketer', 'general', 0.8),
  ('default', 'general', 1.0);

-- Seed hourly curve for Uₜ (Iraqi digital behavior, 24 hourly weights, peaks evenings)
INSERT INTO public.pulse_app_config (key, value) VALUES
  ('hourly_curve', '{"weights":[0.35,0.25,0.18,0.15,0.18,0.25,0.45,0.65,0.80,0.85,0.88,0.92,0.95,0.90,0.85,0.88,0.95,1.05,1.20,1.35,1.40,1.30,1.05,0.70]}'::jsonb),
  ('geoiraq_bridge_enabled', 'false'::jsonb),
  ('disclaimer_ar', '"هذه البيانات تمثل رصداً وتحليلاً إحصائياً دقيقاً ومحدثاً كل 12 ساعة بناءً على المؤشرات العامة المتاحة، وتعتبر مرجعاً استرشادياً لأصحاب الأعمال دون ترتيب أي مسؤولية قانونية أو مالية مباشرة على المنصة."'::jsonb);
