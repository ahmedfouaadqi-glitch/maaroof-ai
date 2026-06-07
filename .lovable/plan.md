
## 1) حذف "نبض" بالكامل

**ملفات الكود التي ستُحذف:**
- المسارات: `src/routes/pulse.tsx`, `pulse.$gov.tsx`, `pulse.assistant.tsx`, `pulse.compare.tsx`, `pulse.sources.tsx`, `admin_.pulse.tsx`
- المكتبات: `src/lib/pulse.functions.ts`, `src/lib/pulse-scraper.server.ts`, `src/lib/pulse-i18n.ts`, `src/lib/pulse-export.ts`
- المكونات: `src/components/PulseMaintenance.tsx`, `PulseSubNav.tsx`, `PulseInfo.tsx`, `BrandPulseGauges.tsx`
- Hook: `src/routes/api/public/hooks/pulse-crawl.ts`
- إزالة كل ذكر لـ pulse من: `src/routes/index.tsx`, `src/routes/dashboard.tsx`, `src/routes/admin.tsx`, `src/routes/sitemap.xml.ts`, `src/components/EnginesOrbit.tsx`, `src/components/Sandbox.tsx`, `src/styles.css`, ترجمات `i18n`

**قاعدة البيانات (migration):**
- إيقاف cron job: `SELECT cron.unschedule('pulse-crawl');`
- حذف الجداول: `pulse_metrics`, `pulse_sources`, `pulse_raw_snapshots`, `pulse_scrape_log`, `pulse_specialty_weights`, `pulse_trending_apps`, `pulse_user_behavior`, `pulse_app_config`
- حذف الدالة: `set_pulse_cron(...)`

---

## 2) الاكتشاف التلقائي للدولة (IP + GPS)

**المرحلة أ — الخادم (IP، فوري ولا يحتاج إذن):**
- إنشاء `src/lib/geo-detect.server.ts` يقرأ ترويسة `cf-ipcountry` من الطلب (Cloudflare يضيفها تلقائياً) + fallback لـ `x-vercel-ip-country`.
- استخدام `beforeLoad` في `__root.tsx` لتمرير `countryCode` كـ context للتطبيق.
- خريطة `CC → { name_ar, name_en, flag }` لأهم الدول العربية والعالمية (`src/lib/countries.ts`).

**المرحلة ب — المتصفح (GPS، اختياري لدقة أعلى):**
- مكون `CountryBadge` يعرض دائماً قيمة الـ IP، وزر صغير "📍 تحديد دقيق" يستدعي `navigator.geolocation.getCurrentPosition`.
- استخدام reverse-geocoding عبر BigDataCloud المجاني بدون مفتاح: `https://api.bigdatacloud.net/data/reverse-geocode-client`.
- تخزين الاختيار في `localStorage` كي لا يتكرر السؤال.

**أماكن العرض:**
- **في الهيدر:** شارة `🇮🇶 العراق` بجانب مبدّل اللغة (مكوّن `CountryBadge`).
- **في الصفحة الرئيسية (Hero):** سطر ترحيب ديناميكي: «مرحباً بزوارنا من **{اسم البلد}**» داخل عنوان أو فوقه.

---

## 3) إعادة التصميم — اتجاهات بصرية

**المسار:**
1. التقاط لقطة للصفحة الرئيسية الحالية (1440px desktop + 390px mobile).
2. سؤالك عن **3 تفضيلات بصرية**: لوحة الألوان، اقتران الطباعة، نمط التخطيط (palette / typography / layout) — كل سؤال مرئي بعينات.
3. توليد **3 اتجاهات تصميمية مرئية** عبر `design--create_directions` مقيّدة بالاختيارات الثلاثة، تختلف فقط في التركيب، الكثافة، الهرمية، والحركة.
4. عرض الـ 3 prototypes بسؤال واحد: «أيّ اتجاه أبني؟».
5. تطبيق الاتجاه المختار حرفياً على: `index.tsx`، الهيدر، الفوتر، صفحات `pricing`, `guide`, `tools.$slug` — مع نسخ design tokens (ألوان/خطوط/مسافات) إلى `src/styles.css`.

**تحسينات المحتوى المُطبّقة مع التصميم:**
- **Hero:** عنوان رئيسي أوضح (Value proposition)، عنوان فرعي يشرح من نحن في سطرين، 2 CTA (ابدأ مجاناً / شاهد عرضاً)، شارة ثقة (X علامة تجارية + شعارات محركات الذكاء).
- **قسم "كيف يعمل"** (3 خطوات بأيقونات).
- **قسم الأدوات** (شبكة بطاقات لأهم 6 أدوات مع وصف من سطر واحد).
- **قسم النتائج/الأرقام** (مقاييس واقعية).
- **قسم الأسئلة الشائعة (FAQ)** مع JSON-LD لتحسين الـ SEO.
- **CTA ختامي** قبل الفوتر.
- ميتا data منفصلة لكل صفحة (title/description/og).

---

## ترتيب التنفيذ في وضع البناء

1. حذف كل ملفات نبض من الكود + تنظيف المراجع + تشغيل migration حذف الجداول/الـ cron.
2. بناء `geo-detect.server.ts` + `countries.ts` + `CountryBadge` ودمجها في الهيدر و Hero.
3. التقاط لقطة → سؤال التفضيلات الثلاثة → توليد 3 اتجاهات → عرضها للاختيار.
4. تطبيق الاتجاه المختار + تحسين المحتوى المقترح أعلاه.
5. إزالة روابط `/pulse*` من sitemap وإضافة الصفحات الجديدة (إن وُجدت).

---

## ملاحظات تقنية

- جداول نبض (8 جداول) ستُحذف نهائياً مع بياناتها — لا رجعة.
- `cf-ipcountry` يعمل على النطاق الرسمي خلف Cloudflare؛ في المعاينة المحلية يكون فارغاً → fallback إلى "غير معروف" بدون عرض ترحيب مخصص.
- BigDataCloud reverse-geocode المجاني لا يحتاج مفتاح API ويعمل CORS من المتصفح مباشرة.
- ملف `src/integrations/supabase/types.ts` يُعاد توليده تلقائياً بعد الـ migration.
