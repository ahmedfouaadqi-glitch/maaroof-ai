# خطة إكمال نظام "نبض"

البنية الأساسية جاهزة (الجداول، الكاشط، صفحة `/pulse`). هذه الخطة تكمل ما تبقى لتشغيل النظام بالكامل.

---

## 1. المسارات (Routes) المتبقية

### `/pulse/$gov` — لوحة المحافظة (استبدال الـ stub الحالي)
- يقرأ `governorates` + آخر `pulse_metrics` للمحافظة (مجمّعة حسب القطاع)
- يعرض Uₜ المحلي = (population_base × نسبة الانتشار الرقمي) × Wₜ
- جدول التطبيقات الرائجة من `pulse_trending_apps` المفلتر بـ `governorate_id`
- **UI Morphing** حسب `profiles.specialty`: ترتيب البطاقات يتغيّر (مهندس/طبيب/تاجر/افتراضي)
- كل تفاعل يكتب صفّاً في `pulse_user_behavior` عبر server fn

### `/pulse/compare` — مقارنة محافظات
- multi-select لمحافظتين فأكثر
- جدول/شارت أعمدة يعرض المؤشرات جنباً إلى جنب

### `/pulse/sources` — شفافية المصادر
- قائمة `pulse_sources` مع `last_success_at` + آخر سجلات `pulse_scrape_log`

### `/pulse/assistant` — المساعد الاستراتيجي
- مربع إدخال سؤال + زر "ولّد"
- يستدعي `pulse-assistant.functions.ts` (Gemini 2.5 Pro) ويعرض markdown
- زر "تصدير Excel"

### `/admin/pulse` — لوحة المالك
- محمي بـ `has_role(admin)`
- يعرض حالة الكشط + زر "تشغيل يدوي" (POST إلى `pulse-crawl`)
- تعديل `hourly_curve` و `geoiraq_bridge_enabled` في `pulse_app_config`

---

## 2. دوال الخادم (createServerFn)

ملف `src/lib/pulse.functions.ts`:

- `computeUt({ governorateSlug? })` — يحسب Uₜ من `population_base × W[hour]` ويرجع `{ ut, hour, curve }`
- `logBehavior({ governorateId?, metricKey?, sector?, action, weight? })` — يحمي بـ `requireSupabaseAuth` ويُدخل في `pulse_user_behavior`
- `getGovernorateDashboard({ slug })` — يجمع المحافظة + مقاييسها الأخيرة + تطبيقاتها
- `runManualCrawl()` — admin only، يطلق محرك الكشط
- `pulseAssistant({ question, governorateSlug? })` — يبني السياق ويستدعي Lovable AI

ملف `src/lib/pulse-export.ts`: دالة `exportPulseReport(rows, meta)` تنتج Excel متعدد الأوراق + ذيل إخلاء المسؤولية.

---

## 3. جدولة الكشط (pg_cron + pg_net)

عبر `supabase--insert` (ليس migration لأنه يحوي مفتاح):
```sql
SELECT cron.schedule(
  'pulse-crawl-12h',
  '0 */12 * * *',
  $$ SELECT net.http_post(
       url := 'https://project--fa07a113-c24f-4419-b1d8-07ffd60e98c6.lovable.app/api/public/hooks/pulse-crawl',
       headers := '{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
```
سنُمكّن `pg_cron` و `pg_net` عبر migration إذا لم يكونا مفعّلين.

---

## 4. التنقل والربط

- إضافة رابط "نبض" في `src/components/SiteHeader.tsx`
- بطاقة "نبض" في `src/routes/dashboard.tsx` للوصول السريع
- تذييل إخلاء المسؤولية في layout قسم `/pulse/*` (مكوّن `PulseFooter`)

---

## 5. ترجمات إضافية في `pulse-i18n.ts`

مفاتيح: `pulse_compare`, `pulse_assistant`, `pulse_export`, `pulse_admin_panel`, `pulse_run_now`, إلخ.

---

## التفاصيل التقنية

- كل المسارات تستخدم `createFileRoute` بدون `as any`
- البيانات تُجلب عبر `createServerFn` (RLS يحمي `pulse_user_behavior` تلقائياً، باقي الجداول قراءة عامة)
- المساعد يستخدم `LOVABLE_API_KEY` الموجود
- لوحة الأدمن تستدعي `has_role` عبر RPC قبل العرض
- تصدير Excel عبر مكتبة `xlsx` (موجودة مسبقاً في `src/lib/exports.ts`)
- نص إخلاء المسؤولية موحّد في `pulse-i18n.ts` (`pulse_disclaimer`) ومضمّن في كل صفحة وكل ملف مصدّر

---

## الترتيب

1. `pulse.functions.ts` + `pulse-export.ts`
2. استبدال `pulse.$gov.tsx` بالنسخة الكاملة + بقية المسارات
3. `/admin/pulse` + جدولة pg_cron
4. ربط التنقل + الترجمات

هل أبدأ التنفيذ؟
