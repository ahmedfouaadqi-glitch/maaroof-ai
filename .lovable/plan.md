# خطة التنفيذ الشاملة

## 1) نظام تنبيهات المنافسين (بريد + داخل التطبيق)
- جدول جديد `competitor_alerts` (user_id, watch_id, type, severity, payload, read_at, created_at) مع RLS.
- توسيع منطق `competitor-monitor` (recheck): عند رصد تغيّر ≥10% أو ≥3 إشارات → إنشاء سجل تنبيه + إرسال بريد.
- تفعيل البريد عبر Lovable Emails (إعداد دومين + قالب `competitor-alert.tsx`).
- زر "تشغيل المراقبة الدورية" يستخدم `pg_cron` يستدعي `/api/public/hooks/competitor-recheck` كل ساعة.
- جرس تنبيهات في الهيدر مع عدّاد غير المقروء + صفحة `/alerts`.

## 2) منشئ التقارير المُحسَّن
- إضافة اختيار نوع الرسم: خط/عمود/رادار/دائري (recharts).
- حفظ قوالب لكل مستخدم: جدول `report_templates` (name, config jsonb) مع RLS.
- تصدير لحظي ومباشر لـ PDF/Excel/CSV لكل أداة عبر زر موحّد `<ExportButtons format="pdf|xlsx|csv">`.
- معاينة لحظية للمخططات قبل التصدير.
- إضافة CSV إلى `src/lib/exports.ts`.

## 3) محرك What-If حقيقي (مرتبط بـ GEO Trust Score)
- إزالة التقديرات التخيلية. يستخدم آخر `brand_boost_runs` + `analyses` + `geo_strategies` كـ baseline حقيقي.
- يحسب before/after لكل محرك (9 محركات) باستخدام معادلة قابلة للتفسير:
  `after = baseline + Σ(weight_i × change_i)` حيث الأوزان مأخوذة من أداء حقيقي مسجَّل سابقاً.
- إخراج: جدول قبل/بعد + شرح السبب لكل محرك + توصية go/wait.
- حفظ كامل في `whatif_scenarios` مع `baseline_snapshot`.

## 4) تحليل اجتماعي بمصادر فعلية
- استبدال أي placeholder بـ `fcSearch` على X/LinkedIn/Reddit/YouTube/TikTok/Facebook.
- استخراج عدد الإشارات، sentiment (gemini-2.5-flash)، أبرز المنشورات، الروابط الفعلية.
- عرض بيانات حقيقية فقط؛ إذا فشل المصدر تُعرض "لا توجد بيانات" بدل أرقام وهمية.

## 5) فحص شامل لإزالة البيانات التجريبية
- مراجعة كل المكونات والمسارات للتحقق من غياب mock/demo/placeholder.
- أي مصدر يفشل يُظهر حالة فارغة واضحة بدل أرقام مولّدة.

## 6) إضافة Kimi كمحرك ذكاء تاسع
- تحديث `engine-logos.tsx` + قائمة المحركات في:
  `BrandPulseGauges`, `AIVisibility`, `WhatIfSimulator`, `GeoStrategist`, `CompetitorMonitor`, تقارير، الصفحة الرئيسية.
- لوغو Kimi + ترجمات (ar/ku/en).

## 7) تحديث محتوى الموقع
- الصفحة الرئيسية: ذكر الأدوات الجديدة (Social, Monitor, Strategist, What-If, Report Builder, Kimi).
- صفحة `/guide`: شرح تفصيلي لكل أداة، كيف تعمل، أمثلة.
- تلميحات (Tooltips) محدّثة في `ToolHelpBanner` لكل أداة.
- تعريفات قصيرة في بطاقات الـ Dashboard.

## 8) فيديوهات وتعريفات احترافية
- إضافة قسم "كيف تعمل" في الصفحة الرئيسية مع:
  - 3 فيديوهات قصيرة (mp4/webm) أو شروحات Lottie مبسّطة.
  - أمثلة قبل/بعد لكل أداة رئيسية.
- مكوّن `<HowItWorks />` قابل لإعادة الاستخدام.

## 9) دعم النهاري/الليلي
- التحقق من `next-themes` أو ToggleTheme موجود؛ إضافة switcher في الهيدر إن لم يوجد.
- مراجعة كل tokens لضمان عمل الوضعين.

## 10) نسيان كلمة المرور
- زر "نسيت كلمة المرور" في `/auth` يستدعي `resetPasswordForEmail` مع `redirectTo: /reset-password`.
- صفحة `/reset-password` (موجودة) تتحقق من `type=recovery` وتُحدّث الكلمة.

## 11) حساب أدمن طوارئ
- migration يُنشئ مستخدم احتياطي:
  - email: `maaroofai@geoiraq.com` (أو نطاق فعلي)
  - username: `maaroofai`
  - password: `148231200`
  - دور: `admin` في `user_roles`.
- ملاحظة أمنية: سيتم تحذير المستخدم بتغيير الكلمة بعد أول دخول.

---

## التفاصيل التقنية

**ملفات جديدة:**
- `supabase/migrations/*_alerts_templates_admin.sql`
- `src/routes/api/competitor-alerts.ts`
- `src/routes/api/public/hooks/competitor-recheck.ts`
- `src/components/AlertsBell.tsx`, `src/routes/alerts.tsx`
- `src/lib/email-templates/competitor-alert.tsx`
- `src/components/HowItWorks.tsx`
- `src/components/ReportTemplateManager.tsx`

**ملفات معدّلة:**
- `src/routes/api/competitor-monitor.ts` (alerts + email)
- `src/routes/api/what-if.ts` (baseline حقيقي + قبل/بعد)
- `src/routes/api/social-analysis.ts` (مصادر فعلية فقط)
- `src/components/ReportBuilder.tsx` (charts + templates + CSV)
- `src/components/{AIVisibility,WhatIfSimulator,GeoStrategist,BrandPulseGauges,CompetitorMonitor}.tsx` (+Kimi)
- `src/components/engine-logos.tsx` (+Kimi)
- `src/lib/exports.ts` (+ CSV)
- `src/routes/{index,guide,auth}.tsx` (محتوى/فيديو/forgot password)
- `src/lib/i18n.tsx` (ترجمات جديدة)

**التكاليف:**
- التنبيهات: 0 وحدات (إعادة الفحص = 2 كما هي)
- What-If: يبقى 2
- Report templates: 0
- Kimi integration: 0

**خطوات تتطلب موافقة المستخدم:**
1. هل النطاق المعتمد للبريد جاهز؟ إن لا، سيُعرض حوار إعداد Lovable Emails.
2. هل يوافق المستخدم على إضافة فيديوهات افتراضية (سأولّدها) أم سيرفع فيديوهات خاصة؟
3. تأكيد إيميل حساب الطوارئ (`maaroofai@geoiraq.com` افتراضياً).

هل أبدأ التنفيذ بهذا الترتيب أم تفضّل أولوية محددة (مثلاً: 11+10 أولاً ثم 1+4 ثم البقية)؟
