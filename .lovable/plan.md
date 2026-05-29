
## الهدف
1. إصلاح تعطّل صفحة `/pulse` (سبب عدم استجابة رابط "نبض").
2. إكمال ما تبقى من نظام نبض.

## 1. إصلاح خطأ الهيدريشن في /pulse (الأولوية القصوى)

**المشكلة:** `useState(new Date())` و `toLocaleString()` تُنفّذ على SSR والمتصفح بقيم مختلفة → React #418 → الصفحة تنهار.

**الحل في `src/routes/pulse.tsx`:**
- تهيئة `now` بـ `useState<Date | null>(null)` ثم تعيينها داخل `useEffect`.
- عرض `ut` فقط بعد التحميل (`mounted` flag) أو إظهار `—` كـ placeholder ثابت أثناء SSR.
- استبدال `toLocaleString()` بصياغة ثابتة (`Intl.NumberFormat('en-US')` أو `.toLocaleString('en-US')`) لتفادي اختلاف locale بين Node والمتصفح.

**نفس المعالجة** في:
- `src/routes/pulse.sources.tsx` (تواريخ `last_success_at`).
- `src/routes/pulse.$gov.tsx` (إن وُجد `Date().toLocaleString` داخل JSX).

## 2. إكمال جلب البيانات الناقصة

- جدول `pulse_trending_apps` فارغ. مراجعة `src/lib/pulse-scraper.server.ts` للمصدرين `trending_apps` و `google_trends`: استخدام مصدر بديل قابل للزحف (مثلاً صفحات Sensor Tower/AppBrain العامة، أو RSS من Google Trends Iraq) لأنّ المصادر الحالية محظورة أو JS-only.
- مصادر `ISX/CMC/CBI/MoP/HDX`: إضافة fallback عبر صفحات alternatives أو APIs عامة. مرحلياً وضع علامة `inactive` للمصادر التي لا تُرجع شيئاً لتجنّب رسائل "—".

## 3. إصلاح كرون 12h
- في الترحيل الموجود للكرون، تغيير الرابط من `geoiraq.lovable.app` إلى `project--fa07a113-c24f-4419-b1d8-07ffd60e98c6.lovable.app` (الرابط المستقر) حتى يعمل قبل/بعد النشر.

## 4. التحقق
- بعد التعديلات: فتح `/pulse` في البريفيو والتأكد من عدم وجود خطأ #418 في الكونسول.
- استدعاء `/api/public/hooks/pulse-crawl` يدوياً للتأكد من امتلاء `pulse_trending_apps`.

## ملاحظات تقنية
- لا تغييرات على المخطط (schema).
- لا أسرار جديدة.
- لا تعديل على ملفات المولَّدة تلقائياً.
