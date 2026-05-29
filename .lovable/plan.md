# تحكم المدير بنشاط "نبض"

إضافة قسم جديد في `/admin/pulse` يسمح للمالك بـ:
1. **تشغيل/إيقاف نظام نبض كاملاً** (يوقف الكشط التلقائي + يخفي الواجهة العامة اختيارياً).
2. **تعديل الفاصل الزمني للكشط** (كل 6 / 12 / 24 ساعة، أو إيقاف الجدولة).

## التخزين
يستخدم جدول `pulse_app_config` الموجود (لا حاجة لمايجريشن):
- `key = 'pulse_enabled'` → `{ enabled: true|false }`
- `key = 'pulse_cron_hours'` → `{ hours: 6|12|24 }`

## التغييرات

### 1. `src/routes/admin.pulse.tsx`
قسم جديد أعلى الصفحة:
- مفتاح Toggle لـ "نظام نبض نشط" (يقرأ/يكتب `pulse_enabled`).
- Select لـ "وقت الكشط التلقائي" بخيارات: كل 6 ساعات / 12 ساعة / 24 ساعة / إيقاف.
- زر "حفظ" يحدّث الـ cron schedule عبر استدعاء server function جديدة.

### 2. `src/lib/pulse.functions.ts`
إضافة `updatePulseCronSchedule({ hours | null })` كـ `createServerFn` محمية بـ `requireSupabaseAuth` + فحص admin role، تنفّذ:
```sql
SELECT cron.unschedule('pulse-crawl-12h'); -- إن وُجد
SELECT cron.schedule('pulse-crawl', '0 */{hours} * * *', $$...net.http_post...$$);
```
عبر `supabaseAdmin.rpc` على دالة SQL `public.set_pulse_cron(hours int)` التي ننشئها مرة واحدة.

### 3. مايجريشن صغيرة
دالة SQL `set_pulse_cron(_hours int)` تُلغي الجدولة الحالية وتعيد إنشاءها بالساعة المطلوبة (أو تُلغيها فقط لو `_hours IS NULL`). `SECURITY DEFINER` لتستطيع الوصول إلى `cron.*`.

### 4. `src/routes/api/public/hooks/pulse-crawl.ts`
فحص في بداية المعالج: إذا `pulse_enabled = false` أرجع `{ skipped: true }` بدون تشغيل الكشط (حماية إضافية حتى لو نسي cron).

### 5. الواجهة العامة (`src/routes/pulse.tsx`)
قراءة `pulse_enabled` وإظهار شارة "النظام في وضع الصيانة" عند الإيقاف (بدون حذف الصفحة).

## ملاحظة فنية
لن نلمس جدولة pg_cron الحالية يدوياً — كل التحكم يمرّ عبر `set_pulse_cron` ليبقى الـ job اسمه `pulse-crawl` ثابتاً.
