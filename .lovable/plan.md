# خطة بناء "نبض" (Pulse)

قسم جديد داخل GEO-Iraq الحالي على المسار `/pulse`، يشارك الحسابات وقاعدة البيانات، قابل للفصل لاحقاً عبر Remix.

يجب ان يتم جمع التطبيقات الاكثر تداولاً او أنتشاراً او استخداماً لكل العراق وايضا لكل محافظة 

---

## 1. حل جمع البيانات الحقيقي 100%

كل المصادر التسعة قانونية ومجانية، نكشطها عبر **Firecrawl** (متصل مسبقاً) كل 12 ساعة:


| المصدر                 | ما نجمعه                  | طريقة الجلب                     |
| ---------------------- | ------------------------- | ------------------------------- |
| COSIT (cosit.gov.iq)   | سكان/عمل/أسعار لكل محافظة | Firecrawl scrape + PDF parse    |
| CMC (cmc.iq)           | مشتركو الإنترنت والهاتف   | Firecrawl scrape                |
| ISX (isx-iq.net)       | أسعار وأحجام تداول يومية  | Firecrawl scrape                |
| Google Trends Iraq     | اهتمام بحثي لكل محافظة    | Firecrawl + endpoint trends-api |
| HDX (data.humdata.org) | CSV مفتوح عن العراق       | fetch مباشر لـ CSV              |
| IOM DTM Iraq           | حركة سكانية               | Firecrawl                       |
| World Bank Iraq        | مؤشرات اقتصادية           | API مفتوح                       |
| CBI (cbi.iq)           | صرف وتضخم                 | Firecrawl                       |
| MoP (mop.gov.iq)       | تقارير قطاعية             | Firecrawl                       |


كل سحب يُخزن خاماً في `pulse_raw_snapshots` ثم يُطبَّع إلى `pulse_metrics`. أي مصدر يفشل يُسجَّل في `pulse_scrape_log` ولا يوقف الباقي.

---

## 2. قاعدة البيانات (جداول جديدة فقط)

- `governorates` — المحافظات الـ18 (slug, name_ar, name_en, name_ku, lat, lng, population_base)
- `pulse_sources` — تعريف المصادر (id, name, url, scrape_config jsonb, active)
- `pulse_raw_snapshots` — كل ما يأتي من الكشط خاماً (source_id, fetched_at, payload jsonb)
- `pulse_metrics` — البيانات المطبَّعة (governorate_id, metric_key, value, unit, source_id, captured_at, sector)
- `pulse_scrape_log` — سجلات تشغيل المحرك (source_id, started_at, status, error)
- `pulse_user_behavior` — البصمة السلوكية (user_id, governorate_id, metric_key, action, weight, created_at)
- `pulse_specialty_weights` — أوزان كل تخصص لكل قطاع (specialty, sector, weight)
- `pulse_app_config` — مفاتيح إعدادات (key, value) — يشمل `geoiraq_bridge_enabled`

جميعها RLS: المستخدم يرى/يكتب سلوكه فقط؛ بقية البيانات للقراءة العامة من `authenticated`؛ الكتابة الإدارية فقط عبر `service_role` من server functions/cron.

---

## 3. محرك الكشط المجدول

- **Server route عام**: `src/routes/api/public/hooks/pulse-crawl.ts` — POST يستقبل من pg_cron، يستخدم `supabaseAdmin` و`@mendable/firecrawl-js` لكشط المصادر بالتوازي.
- **Cron**: `SELECT cron.schedule('pulse-crawl-12h', '0 */12 * * *', ...)` يستدعي المسار عبر `net.http_post` مع `apikey` header.
- **محرك الكشط العكسي**: مسار ثانٍ `pulse-recrawl-personalized.ts` يقرأ `pulse_user_behavior` لآخر 12 ساعة ويعمّق الكشط في القطاعات الأعلى وزناً.

---

## 4. معادلة Uₜ (المستخدمون النشطون لحظياً)

`Uₜ = U₁₂ × Wₜ` حيث `Wₜ` هو الوزن الزمني من منحنى السلوك الرقمي العراقي (24 قيمة لكل ساعة من اليوم) المخزن في `pulse_app_config.key='hourly_curve'`. الحساب يتم في server function يُعاد كل 60 ثانية للواجهة. المنحنى الأولي مبني على دراسات GSMA/ITU العامة للعراق، قابل للتعديل من لوحة المالك.

ملاحظة: هذا تقدير محسوب من بيانات حقيقية، **ليس تتبعاً لمستخدمين خارجيين**. النص في الواجهة يوضّح أنه "تقدير لحظي مبني على آخر 12 ساعة + المنحنى الزمني".

---

## 5. الواجهة (`/pulse/*`)

- `/pulse` — خريطة العراق التفاعلية للمحافظات الـ18 + المؤشرات اللحظية الإجمالية
- `/pulse/$gov` — لوحة محافظة (سكان، نشاط رقمي، Uₜ، أسعار، اتجاهات بحث، قطاعات)
- `/pulse/compare` — مقارنة محافظتين أو أكثر
- `/pulse/sources` — شفافية المصادر وآخر تحديث لكل منها
- `/pulse/assistant` — المساعد الاستراتيجي

**UI Morphing حسب التخصص** (من `profiles.specialty`):

- مهندس/مطور عقاري → مؤشرات هندسية، شبكات
- طبيب → كثافة سكانية + خدمات صحية
- تاجر → أسهم صعود/هبوط + ISX + أسعار
- افتراضي → عرض متوازن

كل تفاعل يكتب صفّاً في `pulse_user_behavior`.

---

## 6. المساعد الاستراتيجي

Server function `pulse-assistant.functions.ts` تستقبل سؤال المستخدم، تقرأ:

1. ملفه (`profiles.specialty`, `brand_name`, `geo_scope`)
2. آخر 50 تفاعل من `pulse_user_behavior`
3. آخر `pulse_metrics` للمحافظات/القطاعات ذات الصلة

ثم تستدعي Lovable AI (`google/gemini-2.5-pro`) بـ system prompt صارم: استخدم البيانات الحية فقط، لا تخمين، صياغة بلغة التخصص. تُولّد دراسات جدوى وخطط استراتيجية كـ markdown منظَّم قابل للتصدير.

---

## 7. تصدير Excel + إخلاء المسؤولية

- نوسّع `src/lib/exports.ts` الحالي بدالة `exportPulseReport` تبني ملف Excel متعدد الأوراق (مؤشرات، مصادر، رسوم).
- تذييل تلقائي في كل ملف وكل صفحة `/pulse/*` بالنص المطلوب حرفياً.

---

## 8. لوحة المالك + جسر geoiraq

- `/admin/pulse` (محمي بـ `has_role(admin)`) — حالة الكشط، تشغيل يدوي، تعديل المنحنى الزمني، تعديل أوزان التخصصات.
- **Toggle الجسر**: مفتاح في `pulse_app_config.geoiraq_bridge_enabled`. عند التفعيل، server function داخلية في GEO-Iraq تُغذّي مؤشرات `pulse_metrics` لمحرك GEO لتحسين خطط الـ GEO/SGE. عند الإيقاف، كل قسم معزول.

بما أن المشروعان داخل نفس قاعدة البيانات حالياً، الجسر = استعلام داخلي محمي ب