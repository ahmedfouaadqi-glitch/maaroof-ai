# خطة: تدقيق وتطوير الأدوات الخمس

## 1) ما هو موجود فعلاً (audit)

| # | الطلب | الحالة | الملف |
|---|---|---|---|
| 1 | تحليل/تحسين الظهور على وسائل التواصل | **جزئي** – يولّد منشورات فقط، بدون تحليل ظهور حقيقي عبر المنصات | `PostSuggester.tsx` |
| 2 | لوحة مراقبة منافسين فورية + تنبيهات | **جزئي** – مقارنة لحظية فقط بدون تتبّع زمني ولا تنبيهات | `CompetitorCompare.tsx` |
| 3 | توصيات GEO مخصّصة (محتوى/كلمات/منصات) | **جزئي** – ضمن نتائج `BrandBoostAgent` لكنها غير مُوحَّدة ولا مرتبطة بالأهداف | `BrandBoostAgent.tsx` |
| 4 | منشئ تقارير مخصّص + تصدير | **جزئي** – تصدير ثابت (PDF/CSV) للأنشطة فقط، بلا اختيار مقاييس | `ExportButtons.tsx` + `dashboard.tsx` |
| 5 | محاكاة "ماذا لو" (What-If) | **غير موجود** | — |

## 2) خطة التنفيذ

### (1) تحليل الظهور الاجتماعي — تطوير `PostSuggester`
- إضافة تبويب **"تحليل اجتماعي"** يستخدم `fcSearch` على `site:twitter.com / linkedin.com / reddit.com / youtube.com` للعلامة + الكلمات.
- إرجاع: عدد الإشارات لكل منصة، أبرز المنشورات، تحليل المشاعر عبر Lovable AI (`gemini-2.5-flash`)، وفجوات المحتوى.
- مخرَج JSON يُغذّي مولّد المنشورات الحالي تلقائياً (روابط، هاشتاجات، أفضل أوقات نشر مستنتجة من تواريخ المنشورات).

### (2) مراقبة المنافسين الفورية — أداة جديدة `CompetitorMonitor`
- جدول جديد `competitor_watch` (user_id, brand, competitors[], baseline jsonb, frequency_hours, last_run, alerts jsonb) + RLS + GRANT.
- زر **"بدء المراقبة"** يحفظ baseline (visibility + سيرب + برومبتات AI).
- `pg_cron` كل N ساعة → `/api/public/hooks/competitor-watch` يعيد التشغيل ويقارن بـ baseline ويسجّل التغييرات (≥10%) في `alerts`.
- لوحة تنبيهات داخل `dashboard.tsx` تعرض الأحداث (badge أحمر، إشعار toast عند الفتح).

### (3) توصيات GEO مخصّصة — أداة جديدة `GeoStrategist`
- نموذج إدخال: العلامة + الأهداف (وعي/تحويل/سلطة) + الميزانية + السوق الجغرافي.
- تستهلك آخر تقرير `brand_boost` + `ai_visibility` المخزّن وتمرّره مع الأهداف إلى `gemini-2.5-flash` بـ schema:
  - `content_types[]`، `priority_keywords[]`، `priority_platforms[]`، `editorial_calendar[12 week]`، `kpi_targets`.
- تُحفظ في جدول `geo_strategies` لإعادة الاستخدام + تصدير PDF.

### (4) منشئ تقارير مخصّص — أداة جديدة `ReportBuilder`
- واجهة drag‑select لاختيار: المقاييس (visibility/competitors/social/brand boost)، المدى الزمني، الرسوم (bar/line/donut عبر `recharts` الموجود)، اللغة.
- معاينة حيّة + تصدير **PDF/CSV/PNG** عبر `src/lib/exports.ts` (تمديد `kind: "chart"`).
- حفظ "قوالب التقرير" في جدول `report_templates` لإعادة التوليد بنقرة.

### (5) محاكاة "ماذا لو" — أداة جديدة `WhatIfSimulator`
- يقرأ baseline من تقارير المستخدم.
- نموذج تغييرات: + نوع محتوى جديد، + كلمة مفتاحية، تغيير الجمهور، تغيير المنصة، زيادة نشر X%.
- يستدعي Lovable AI بمطالبة محاكاة محافظة (لا أرقام مخترعة — نسب تقديرية مع `confidence`).
- يعيد: تأثير متوقّع لكل محرك (chatgpt/gemini/perplexity/…)، تكلفة تقديرية، مخاطر، توصية نهائية.
- 2 وحدة تحليل لكل سيناريو.

### دمج في `dashboard.tsx`
ترتيب البطاقات: Visibility → Social Analysis → Competitor Monitor → GEO Strategist → What-If → Report Builder → Brand Boost.

## 3) تفاصيل تقنية (موجزة)
- جميع نقاط النهاية = `createServerFn` ضمن `src/lib/*.functions.ts` مع `requireSupabaseAuth`.
- استخدام `LOVABLE_API_KEY` فقط؛ نموذج افتراضي `google/gemini-2.5-flash` (تحليل) و `openai/gpt-5-mini` (توصيات حسّاسة).
- الجداول الجديدة: `competitor_watch`، `geo_strategies`، `report_templates` + GRANT + RLS scoped على `auth.uid()`.
- cron عبر `set_pulse_cron`-style helper.
- التكلفة (وحدات تحليل): Social=1، Monitor (لكل تشغيل cron)=2، GEO Strategist=3، What-If=2، Report=0.

## 4) خارج النطاق
- لا أتطرق إلى أدوات نبض (Pulse) ولا إلى تدفقات الدفع — فقط إضافة/تطوير الأدوات الخمس.

هل أبدأ التنفيذ بهذه الخطة، أم تفضّل تعديل الأولويات (مثلاً البدء بـ What-If + Monitor فقط)؟
