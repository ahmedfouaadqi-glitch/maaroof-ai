
## السياق

كل المكوّنات الأساسية لـ "نبض" مبنية وتعمل (الصفحات، الكشط، الجدولة كل 12 ساعة، المساعد الاستراتيجي، لوحة المالك، تصدير Excel). تبقّت 3 أشياء صغيرة فقط لإغلاق المشروع:

1. **لا يوجد تنقّل فرعي داخل /pulse** — المستخدم يصل لـ `/pulse` لكن لا يرى روابط واضحة لـ `compare` / `sources` / `assistant`.
2. **الـDashboard لا يحوي بطاقة نبض** — مستخدمو المنصة لا يكتشفونه.
3. **`pulse_metrics` فيها 0 صفوف** — الكرون مجدول كل 12 ساعة لكن لم يعمل بعد ولا أحد شغّل كشطاً يدوياً. يجب تشغيل دورة كشط أولى الآن حتى تظهر بيانات حقيقية في كل الصفحات.

## التغييرات

### 1. مكوّن `PulseSubNav` جديد

ملف: `src/components/PulseSubNav.tsx`

شريط تنقّل صغير يُستخدم في كل صفحات `/pulse/*`:
- نظرة عامة → `/pulse`
- مقارنة → `/pulse/compare`
- المساعد → `/pulse/assistant`
- المصادر → `/pulse/sources`
- لوحة المالك → `/admin/pulse` (تظهر فقط للأدمن)

يستخدم `usePulseI18n` للترجمات الموجودة (`pulse_overview`, `pulse_compare`, …).

ثم أدخله أعلى الـ`<main>` في:
- `src/routes/pulse.tsx`
- `src/routes/pulse.$gov.tsx`
- `src/routes/pulse.compare.tsx`
- `src/routes/pulse.sources.tsx`
- `src/routes/pulse.assistant.tsx`
- `src/routes/admin.pulse.tsx`

### 2. بطاقة نبض في الـDashboard

في `src/routes/dashboard.tsx` أضف بطاقة Link → `/pulse` بين البطاقات الموجودة، بعنوان "نبض المحافظات" ووصف قصير "رصد حي لمحافظات العراق كل 12 ساعة" مع أيقونة `Activity` (مستوردة سابقاً).

### 3. تشغيل أول دورة كشط فعلية

استدعاء HTTP واحد لـ `/api/public/hooks/pulse-crawl` (POST مع `apikey`) عبر `stack_modern--invoke-server-function` بعد نشر التغييرات، حتى تمتلئ `pulse_metrics` و`pulse_trending_apps` ببيانات Firecrawl + Lovable AI الحقيقية من المصادر الـ10. هذا يحوّل كل الصفحات من "لا توجد بيانات" إلى عرض حي.

## تفاصيل تقنية

- `PulseSubNav` يقرأ `useAuth` بشكل دفاعي (try/catch) لأن بعض الصفحات قد لا تكون داخل `AuthProvider`.
- لا تغييرات على قاعدة البيانات، ولا migrations، ولا أسرار جديدة (`FIRECRAWL_API_KEY` و`LOVABLE_API_KEY` موجودان).
- لا تعديل على `pulse-i18n.ts` (المفاتيح اللازمة موجودة).
- لا تعديل على ملفات auto-generated.

## الترتيب

1. أنشئ `PulseSubNav.tsx`.
2. أدخله في الستّ صفحات.
3. أضف بطاقة نبض في `dashboard.tsx`.
4. شغّل دورة الكشط الأولى وأكّد ظهور صفوف في `pulse_metrics`.
