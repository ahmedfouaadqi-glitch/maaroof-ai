# خطة الموجة 2 — الإكمال بالترتيب

## 1) تثبيت "9 منصات" في كل مكان
- `src/components/EnginesOrbit.tsx`: تحديث التعليق `8 AI engines` → `9 AI engines` + التحقق من رسم Kimi ضمن قائمة `engines`.
- `src/lib/i18n.tsx`: تغيير `compare_how_platforms` من "8 AI platforms" → "9 AI platforms" وإضافة Kimi إلى قائمة الـAPI/closed، ومراجعة أي ترجمة عربية موازية تذكر "ثماني" أو "8".
- `src/components/engine-logos.tsx`: التأكد من وجود تصدير `KimiLogo` واستخدامه في الـorbit وفي بطاقات الـhero بالـ`index.tsx`.
- `src/routes/index.tsx`: مراجعة قائمة المنصات في الـHero (السطور ~140-220) لإدراج Kimi مع لون tint وtagline.

## 2) إعادة تصميم `dashboard.tsx` — حذف وتنظيف
حذف الكتل التالية بالكامل من `src/routes/dashboard.tsx`:
- **"طلب اشتراك"** والروابط/البطاقات المرتبطة (subscription request CTA).
- قسم **"الخلاصة / Summary"** (الإحصاءات أعلى الصفحة).
- قسم **"النشاط الأخير / Recent Activity"** (قائمة `analyses` + `suggestions`).
- أزرار **"تصدير الخلاصة / Export Summary"** و **"عرض التحليلات"** والروابط لـExportButtons.
- مكوّن `<GeoScopeSelector />` من dashboard (السطر 188) — **يبقى فقط في الأدوات وفي `profile.tsx`**.

يبقى في dashboard:
- ترحيب باسم المستخدم + شارة الدولة (`CountryBadge`).
- شبكة الأدوات (16 أداة) كبطاقات نظيفة.
- `SpecialtyBanner` (اختياري — يُبقى).
- بدون أي أرقام تكلفة/وحدات.

## 3) تصدير مركزي — `ReportBuilder` فقط
- إزالة استدعاءات `<ExportButtons />` و`<PrintAnalysisButton />` من جميع مكوّنات الأدوات:
  `AIVisibility, AppliedRanking, BizDev, BrandBoostAgent, CompanyOutreach, CompetitorCompare, FeasibilityStudy, PostSuggester, SmartResearch` وأي مكان آخر.
- إزالة استيراداتها من نفس الملفات.
- إبقاء الملفات `ExportButtons.tsx` و`PrintAnalysisButton.tsx` لاستخدامها داخل `ReportBuilder` فقط.
- `ReportBuilder` يبقى البوابة الوحيدة للتصدير: المستخدم يختار التحليل المحفوظ + الصيغة (PDF/CSV/Print/JSON)، والتكلفة مقروءة من `tool_pricing_catalog` (مفتاح `report_builder` أو مفاتيح فرعية للتصدير).

## 4) إخفاء وحدات التكلفة للمستخدم
- إزالة `<CostBadge />` من بطاقات الأدوات في dashboard وأي صفحة عامة.
- في `pricing.tsx` و`guide.tsx` و`index.tsx`: حذف أي جدول/رقم "X وحدة لكل أداة" — الإبقاء فقط على وصف الباقات.
- العرض المخصّص "1 وحدة" داخل بطاقة الأداة يبقى مخفياً افتراضياً ويُفعَّل عبر إعداد من لوحة الإدارة (تم في الموجة 1 بمفتاح `show_cost_per_user`).

## 5) الموقع الجغرافي
- `GeoScopeSelector`: حذف من dashboard. الإبقاء داخل صفحات الأدوات `tools.$slug.tsx` وفي `profile.tsx` كقسم تفضيلات.

## 6) صفحة `profile.tsx` — تحديث محتوى
- إعادة كتابة بأقسام: المعلومات الشخصية، تفضيلات الدولة/النطاق الجغرافي، اللغة، الباقة الحالية (بدون أرقام وحدات لكل أداة)، زر "اطلب ترقية" يفتح `SubscribeModal`.
- لا توجد إحصاءات استخدام تفصيلية، فقط: الرصيد الإجمالي + المستخدم اليوم/الشهر (نص بسيط).

## تفاصيل تقنية
- Search-replace لجميع تطابقات `8` في سياق المنصات (لا تتأثر `size-8`, `mt-8` الخ — فقط نصوص العدّ).
- ترتيب التعديلات: i18n + EnginesOrbit + index.tsx (Kimi) → dashboard.tsx (تنظيف) → إزالة Export buttons من 9 مكونات أدوات → profile.tsx → pricing/guide تنظيف.
- لا تغييرات schema في هذه الموجة — كل المفاتيح المطلوبة موجودة (`per_user_tool_overrides`, `tool_pricing_catalog`).

## النتيجة بعد التطبيق
- العدد "9" يظهر بثبات في الواجهة والـorbit ووصف المقارنة.
- dashboard مبسّطة: ترحيب + شبكة أدوات فقط.
- التصدير حصرياً عبر "منشئ التقارير".
- لا أرقام وحدات/تكلفة في الصفحات العامة.
- النطاق الجغرافي في الأدوات والملف الشخصي فقط.
