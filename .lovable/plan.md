# خطة العمل الشاملة

## 1) إضافة منصة Kimi (لتصبح 9 منصات)

**الموقع المركزي:** `src/components/engine-logos.tsx` + كل قائمة `PLATFORMS_8`.

- إعادة تسمية `PLATFORMS_8` → `PLATFORMS_9` في `src/lib/platform-probe.server.ts` مع إضافة `"kimi"` وقاعدة scoring خاصة بها (Moonshot AI – سياقات طويلة، صيني/إنجليزي، تقني).
- إضافة شعار/أيقونة Kimi في `engine-logos.tsx` و`EnginesOrbit.tsx`.
- تحديث كل النصوص التي تذكر «8 منصات» إلى «9 منصات» (index/guide/pricing/features/how-it-works/dashboard/profile).
- تحديث كل أدوات التحليل التي تُرجع scores لكل منصة (compare/visibility/applied-ranking/social-analysis/brand-authority) لتشمل `kimi`.
- تعريف Kimi المعتمد افتراضياً: **«Kimi — مساعد Moonshot AI الصيني المتخصص بالسياقات الطويلة جداً (200K+ token) والتحليل التقني، بالعربية والإنجليزية والصينية.»** (قابل للتعديل لاحقاً.)

## 2) استبدال «العراق» تلقائياً باسم دولة المستخدم

- إضافة hook `useTagline()` في `src/lib/use-country.tsx` يُرجع نصاً مثل: «تحسين محركات الذكاء التوليدي · {دولة المستخدم}» بثلاث لغات؛ يستخدم `info.name_ar/en/ku` من `useCountry`.
- استبدال كل النصوص الثابتة «· العراق» في:
  - `src/routes/index.tsx` (Hero)
  - `src/routes/__root.tsx` (meta/og إذا أمكن client-side)
  - `src/components/SiteHeader.tsx`
  - أي مكان آخر فيه «العراق» كوصف للمنصة (وليس كاسم دولة جغرافي ضمن بيانات).
- وضع fallback إلى «عالمياً / Global» قبل اكتمال الاكتشاف.

## 3) حذف عبارة «المنصة العراقية للبحث بالذكاء»

بحث عام بـ ripgrep واستبدال أو حذف من كل الملفات (`index.tsx`, `guide.tsx`, `pricing.tsx`, `__root.tsx`, `llms.txt`, `manifest.webmanifest`, robots/sitemap titles…). تُستبدل بـ «MAAROOF Ai — تحسين محركات الذكاء التوليدي».

## 4) إخفاء أزرار التصدير من كل الأدوات

- حذف استخدامات `ExportButtons` و`PrintAnalysisButton` من كل المكونات (`AIVisibility, AppliedRanking, BizDev, BrandBoostAgent, CompanyOutreach, CompetitorCompare, CompetitorMonitor, FeasibilityStudy, GeoStrategist, PostSuggester, SmartResearch, SocialAnalysis, WhatIfSimulator, Sandbox, …`).
- الاحتفاظ بالملفات نفسها (لاستخدامها داخل `ReportBuilder` فقط).
- توسيع `ReportBuilder`: يصبح هو البوابة الوحيدة للتصدير — يختار المستخدم: الأداة + النتيجة المحفوظة + الصيغة (PDF/CSV/Print/JSON).
- ربط تكلفة التصدير بمفتاح جديد في `tool_pricing_catalog` (مثل `report_export.pdf`, `report_export.csv`) قابل للتعديل من لوحة الإدارة (`AdminPlanPricingPanel`).

## 5) إخفاء أعداد الوحدات من كل الواجهات + ضبط من الإدارة

- إخفاء `CostBadge` افتراضياً من بطاقات الأدوات، صفحات `pricing/guide/index`.
- إضافة عمود/سياسة في `tool_pricing_catalog` أو `per_user_tool_overrides` يسمح للأدمن **بتفعيل ظهور التكلفة لكل مستخدم على حدة** (toggle: `show_cost_to_user`).
- داخل بطاقة الأداة فقط (`tools.$slug.tsx`): إذا فعّل الأدمن العرض لهذا المستخدم → يُعرض «X وحدة» بوضوح. غير ذلك يبقى مخفياً.
- إزالة جداول الأسعار/الوحدات من `pricing.tsx` و`guide.tsx` و`index.tsx`.

## 6) إعادة بناء المحتوى والتصميم لكل الصفحات

تطبيق هوية **Midnight Indigo + DM Serif Display + Fira Sans + Hero/Grid** على:

| الصفحة | المحتوى الجديد |
|---|---|
| `/dashboard` لوحتي | إعادة كاملة: ترحيب باسم المستخدم + بلده، شريط حالة (تحليلات اليوم/الشهر، الرصيد)، شبكة بطاقات لكل أداة (16+ أداة) مع وصف موجز، آخر التحليلات، اختصارات الوكيل |
| `/profile` ملفي | بيانات الحساب، URL الشخصي u/username، الاشتراك، الإحصاءات، الأجهزة المربوطة، تغيير اللغة، حذف الحساب |
| `/guide` دليل المستخدم | شرح كل الأدوات الـ16+ بلغة مبسّطة بدون أرقام تكاليف، GIFs/screenshots وصفية، حالات استخدام |
| `/contact` اتصل بنا | نموذج تواصل + قنوات (واتساب/إيميل) + خريطة دعم حسب الدولة |
| `/admin` الإدارة | تبويبات منظمة: المستخدمون، الأدوار، الخطط، التسعير، الـ ledger، الـ tokens، روابط الأدوات، الإعدادات العامة، التحكم في ظهور التكلفة لكل مستخدم |
| `/terms` و `/privacy` | تحديث الصياغة لتعكس MAAROOF Ai (لا GEO-Iraq)، وإضافة فقرة الـ geo-detection (IP/GPS) |
| `/pricing` الأسعار | 3 خطط (Starter/Pro/Business) + add-ons الوكيل، بدون عرض «X وحدة لكل أداة» |
| الصفحة الرئيسية `/` (المزايا + كيف يعمل) | Hero ديناميكي بدولة المستخدم، 9 منصات AI، 3 خطوات «كيف يعمل»، شبكة المزايا، CTA |
| `/agent` الوكيل | شرح الوكيل المستقل، أنواع المهام، تشغيل/إيقاف، add-ons |

## 7) ملاحظات تنفيذية

- جميع تغييرات قاعدة البيانات (عمود `show_cost_to_user`، أسعار التصدير الجديدة) ستُمرَّر عبر هجرات منفصلة للمراجعة.
- لن تُلمس أي ميزة وظيفية في الأدوات إلا حذف زر التصدير منها.
- بحث وحذف نهائي لكلمة «نبض» (تأكيد).

## تفاصيل تقنية

- **Kimi scoring rubric:** يضاف إلى `PLATFORM_RUBRIC` في `platform-probe.server.ts`: يُرجَّح بـ multilingual + technical structured pages + long-form content + Chinese/EN sources.
- **`useTagline`:** يستهلك `useCountry().info` ويعيد string جاهز للعرض؛ يدعم SSR fallback.
- **Pricing toggle:** حقل `show_cost_per_user JSONB` على `profiles` أو عمود boolean على `per_user_tool_overrides`؛ الواجهة تقرأها عبر server fn `getMyDisplayPrefs`.
- **ReportBuilder كبوابة:** يستخدم سجل تحليلات المستخدم من `analyses` ويعرض dropdown للنتائج القابلة للتصدير.
- **حذف ExportButtons من الأدوات:** عملية mechanical، اختبار بصري لكل أداة بعد الحذف.

