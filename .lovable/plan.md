## المشكلة

في صفحة الأسعار حالياً:
1. تحت السعر تظهر كلمة **"شهرياً"** دائماً مهما كانت مدة الخطة. لو الإدارة كتبت 180 يوم لازم يظهر "كل 6 أشهر"، 90 يوم → "كل 3 أشهر"، 365 → "سنوياً"، الخ.
2. شارة الخصم (الأخضر فوق الكرت) تظهر **تلقائياً** لأي خطة مدتها ≥ 365 يوم، والإدارة ما تقدر تتحكم بها ولا تكتب نص الخصم.

## المطلوب

### 1) نص الفترة الديناميكي
حساب تلقائي من `duration_days`:
- 7 → أسبوعياً
- 14 → كل أسبوعين
- 30 → شهرياً
- 60 → كل شهرين
- 90 → كل 3 أشهر
- 180 → كل 6 أشهر
- 270 → كل 9 أشهر
- 365 → سنوياً
- 730 → كل سنتين
- أي قيمة أخرى → "كل N يوم/شهر" حسب الأقرب

يُطبَّق في كرت الخطة في `src/routes/pricing.tsx` (السطر 193) وكذلك تحت السعر الموحّد. مدعوم بالعربي/الإنجليزي/الكردي.

### 2) شارة الخصم تحت تحكم الإدارة
إضافة حقلين جديدين لكل خطة في قاعدة البيانات:
- `discount_badge_enabled` (boolean) — تشغيل/إيقاف الشارة
- `discount_badge_text` (text, nullable) — نص حر يكتبه الأدمن (مثلاً "وفّر 20%" أو "عرض خاص")

استبدال الشرط الحالي `isYearly` بـ `p.discount_badge_enabled && p.discount_badge_text`. إذا الشارة مفعّلة بدون نص نعرض نص افتراضي بسيط ("خصم").

### 3) محرر الإدارة
في `src/routes/admin.tsx` داخل `PlanRow` (وضع التحرير) إضافة:
- **Switch**: "إظهار شارة خصم"
- **Input** نصي: "نص الشارة" (يظهر فقط لما السويتش مفعّل)

تمرير الحقلين ضمن `adminUpdatePlan` patch، وإضافتهما في `planPayload` في `src/lib/admin.functions.ts`.

## التفاصيل التقنية

**Migration**
```sql
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS discount_badge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_badge_text text;
```

**ملف جديد**: `src/lib/period-label.ts` يصدّر `formatPeriod(days, locale)` لإعادة الاستخدام.

**ملفات تتعدّل**:
- `src/routes/pricing.tsx` — استبدال السطر 193 و270 بـ `formatPeriod`، وشرط الشارة بـ `discount_badge_enabled`.
- `src/routes/admin.tsx` — حقول التحرير الجديدة في `PlanRow`.
- `src/lib/admin.functions.ts` — توسيع `planPayload` بالحقلين.
- `src/lib/i18n.tsx` — مفاتيح الفترات (`period_weekly`, `period_every_n_months`, …).

**ملاحظة**: الحقول `pr_monthly` و `pr_save_50k` و `pr_yearly_first` تبقى كـfallback ولا تُحذف.
