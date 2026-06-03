# إيقاف شامل لنظام "نبض"

الهدف: تعطيل نظام نبض كلياً — لا كشط، لا cron، لا استدعاءات — وإظهار شاشة "تحت الصيانة" مع شعار الموقع وأنميشن عند الدخول على أي صفحة من صفحات نبض. لا يُعاد التشغيل إلا بأمر صريح منك لاحقاً , وحذف لكل روابط وبرمجة واعدادات وتفاعل .

## 1) إيقاف الكشط والـ cron (Backend)

عبر migration واحد:

- `UPDATE public.pulse_app_config SET value = '{"enabled": false}'::jsonb WHERE key = 'pulse_enabled';` (إدراج الصف إن لم يوجد).
- `UPDATE public.pulse_app_config SET value = '{"hours": 0}'::jsonb WHERE key = 'pulse_cron_hours';`
- استدعاء `cron.unschedule` لأي job باسم يبدأ بـ `pulse-crawl%` لفصل الجدولة فوراً.
- `UPDATE public.pulse_sources SET active = false;` لتعطيل كل المصادر.

## 2) قفل صلب على مستوى الكود (Hard kill)

في `src/routes/api/public/hooks/pulse-crawl.ts`:

- إضافة ثابت `const PULSE_KILL_SWITCH = true;` في أعلى الملف.
- في بداية الـ POST handler: إذا كان مفعّلاً يرد فوراً `Response.json({ ok: false, disabled: true, reason: "pulse_under_maintenance" }, { status: 503 })` — قبل أي فحص أو اتصال بقاعدة البيانات أو أي مصدر خارجي.

هذا يضمن أن أي محاولة (يدوية، cron قديم، webhook خارجي) تُرفض حتى لو بقي شيء مجدول.

## 3) شاشة "تحت الصيانة" على واجهة نبض

استبدال محتوى صفحات نبض التالية بمكوّن صيانة موحّد:

- `src/routes/pulse.tsx`
- `src/routes/pulse.$gov.tsx`
- `src/routes/pulse.compare.tsx`
- `src/routes/pulse.assistant.tsx`
- `src/routes/pulse.sources.tsx`

إنشاء مكوّن `src/components/PulseMaintenance.tsx` يعرض:

- شعار الموقع (`maaroof-logo-full.png` داخل `HexBadge`) مع أنميشن نبض/دوران لطيف (`animate-pulse` + `logo-float` + هالة gradient).
- عنوان: "نبض تحت الصيانة"
- نص قصير: "نعمل على تحسين النظام. سيعود قريباً."
- زر رجوع إلى `/dashboard`.
- استخدام tokens التصميم (`--gradient-hero`, `clip-hex`, `--shadow-glow`) للحفاظ على الهوية.

كل route من routes نبض الخمسة يصبح: `component: () => <PulseMaintenance />` فقط (لا يحمّل أي بيانات، لا يستدعي Supabase، لا `PulseSubNav`).

## 4) إخفاء روابط نبض من التنقل

- في `src/components/SiteHeader.tsx` و`src/routes/dashboard.tsx` و`src/routes/index.tsx`: إزالة/إخفاء أي رابط `to="/pulse"` ظاهر للمستخدم.
- إبقاء روابط الإدمن (`/admin/pulse`) كما هي حتى يستطيع المالك إعادة التشغيل لاحقاً، مع شارة "Maintenance" واضحة.

## 5) لوحة الأدمن

في `src/routes/admin_.pulse.tsx`: إظهار بانر علوي أحمر "نبض موقوف بالكامل (Kill Switch مفعّل في الكود)" مع تنبيه بأن إعادة التشغيل تتطلب:

1. إزالة `PULSE_KILL_SWITCH` من ملف الـ webhook.
2. تشغيل `pulse_enabled` من نفس اللوحة.

## ما لن يتغيّر

- جداول/بيانات نبض الموجودة (لن تُحذف).
- بقية أدوات الموقع.
- الهوية البصرية والشعار.

## ملفات تتأثر

- migration جديد (config + unschedule + sources).
- `src/routes/api/public/hooks/pulse-crawl.ts` (kill switch).
- `src/components/PulseMaintenance.tsx` (جديد).
- `src/routes/pulse.tsx`, `pulse.$gov.tsx`, `pulse.compare.tsx`, `pulse.assistant.tsx`, `pulse.sources.tsx`.
- `src/components/SiteHeader.tsx`, `src/routes/dashboard.tsx`, `src/routes/index.tsx` (إخفاء روابط).
- `src/routes/admin_.pulse.tsx` (بانر).

عند الموافقة، سأنفّذ كل ما سبق في build mode.