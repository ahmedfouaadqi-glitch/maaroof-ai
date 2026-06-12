# خطة التحسين الشاملة (5 محاور)

## 1) رفع جودة الأدوات والموقع — "نادر ومميز وحقيقي"
- تشديد قواعد المصدر في كل برومبت أدوات (Smart Research / Compare / Visibility / AppliedRanking / BizDev / Feasibility / Social / GeoStrategist / WhatIf / CompanyOutreach):
  - منع التخمين: إذا لم يوجد دليل من Firecrawl/إدخال المستخدم → يُصرَّح بـ`evidence_missing` ويُخفّض الـconfidence (موجود جزئياً في `FACTUAL_SAFETY_PROMPT`، سيُفرض في كل API).
  - إضافة حقل `sources[]` (url + snippet) إلزامي في مخرجات كل أداة، وعرضه في الواجهة كـ"المصادر" قابل للنقر.
  - إضافة `rarity_score` و`uniqueness_notes` (لماذا هذه التوصية غير شائعة) في الأدوات التحليلية.
- تحسين السكور: استبدال أي قيم ثابتة/افتراضية بحسابات من المدخلات الفعلية + Firecrawl.
- تنقيح صفحات الموقع العامة (index/guide/pricing): مراجعة العناوين الفارغة، إضافة `og:image` المفقودة، تشديد H1 الموحّد.

## 2) تكلفة حقيقية لكل أداة/طلب/مستخدم في لوحة الإدارة
الحالة الحالية: `AdminLedgerPanel` يعرض tokens + usd من `token_ledger`، لكن `usd_cost` يُحتسب حالياً من جدول تسعير ثابت لا من الاستهلاك الفعلي.
التغييرات:
- توسيع `token_ledger.meta` ليُسجّل لكل طلب: `provider` (lovable-ai/firecrawl/semrush)، `model`، `prompt_tokens`، `completion_tokens`، `firecrawl_units` (search=1, scrape=1, deep=5)، `latency_ms`، `endpoint`.
- إنشاء helper `recordSpend({userId, toolKey, runId, items[]})` في `src/lib/spend.server.ts` يحوّل وحدات كل مزوّد إلى USD وفق جدول `provider_rates` جديد (Lovable AI per 1M tokens حسب الموديل + Firecrawl per credit + Semrush per call).
- استبدال نداءات `chargeTokens` المباشرة في كل API route بـ wrapper جديد يُسجّل الكلفة الحقيقية + يخصم التوكن.
- إضافة تبويب جديد في الإدارة "تكلفة المزوّدين" يعرض: تكلفة/مستخدم، تكلفة/أداة، تكلفة/طلب، توزيع المزوّدين (Lovable AI vs Firecrawl)، Margin مقابل ما يدفعه المستخدم.
- إثراء `AdminLedgerPanel` بأعمدة: المزوّد، الموديل، Firecrawl units، Latency.

## 3) مراقبة Firecrawl وتقليل الاستهلاك + سياسة استخدام
- جدول جديد `firecrawl_usage` (user_id, tool_key, op: search|scrape, units, query_hash, cache_hit, created_at).
- في `src/lib/firecrawl.ts`:
  - **كاش 24h**: قبل النداء، فحص `analysis_cache` بمفتاح `firecrawl:{op}:{hash}` — إن وُجد، يُعاد بدون نداء API ويُسجَّل `cache_hit=true`.
  - **حدود**: قراءة `app_settings.firecrawl_policy` (يومي/شهري لكل أداة ولكل مستخدم + سقف عالمي). تجاوز السقف → خطأ واضح "تم بلوغ حد الاستهلاك".
  - **خفض الكلفة الافتراضية**: تقليل `limit` الافتراضي للبحث من 6 إلى 4، تعطيل `deep` ما لم يُطلب صراحة، استخدام `onlyMainContent:true` دائماً.
- تبويب إدارة جديد "Firecrawl" يعرض: استخدام يومي/شهري، أعلى المستخدمين، أعلى الأدوات، نسبة الـcache hits، أزرار تعديل الحدود لكل أداة (مثل: `brand_boost`: 200/شهر، `competitor_monitor`: 50/يوم …).

## 4) تعريب تبويبات الإدارة الجديدة
كل النصوص الإنجليزية الحالية في الملفات التالية ستُستبدل بـ`useI18n()` + قاموس ثلاثي (ar/en/ku) مع تبسيط الصياغة:
- `ContentStudioTab.tsx` — "محرر المحتوى" (مفاتيح، الكل، بحث، حفظ، حذف، ترجمة تلقائية…)
- `HeaderConfigTab.tsx` — "الهيدر والروابط" (الإظهار، روابط إضافية، أرقام تواصل…)
- `ExportConfigTab.tsx` — "إعدادات التصدير"
- `UserIntelligenceTab.tsx` — "ذكاء المستخدمين"
- `CognitiveInsightsTab.tsx` — "رؤى الإدراك"
- تسميات التبويبات نفسها في `src/routes/admin.tsx` تُعرّب وفق `useI18n().lang`.

## 5) إصلاح الترجمة التلقائية في CMS
المشكلة: زر "Auto-translate missing" في `ContentStudioTab` يستدعي `adminBulkAutoFill` لكن بعض الحالات لا تُحدّث الواجهة بسبب:
- النتائج تُكتب في DB لكن لا يُعاد تحميل الـmap بشكل صحيح (الـlocalStorage cache يطغى).
- المصدر يختار الحقل الأول الموجود (ar أولاً) ما يجعل ar=null + en=value + ku=null لا يترجم لـar (لأنه يبدأ من ar).
- عدم وجود لوغ/رسالة عند فشل عنصر واحد فيُلغى الباتش الكامل.

التصحيحات:
- في `adminBulkAutoFill`: تحديد المصدر = أول حقل **غير فارغ** (بالفعل صحيح، لكن نضيف trim + معالجة `""`).
- معالجة كل صف داخل `try/catch` منفصل وإرجاع `{ok, count, failed[]}`.
- بعد النجاح: `invalidateContent()` يمسح `localStorage[geo-site-content-v1]` ويُعيد التحميل (إضافة `localStorage.removeItem` داخل `invalidateContent`).
- إظهار toast بعدد المترجم/الفاشل.
- إضافة زر "ترجمة تلقائية" لكل صف حتى لو الحقول كلها فارغة عدا واحد، مع تحديد لغة المصدر يدوياً عبر dropdown صغير عند الحاجة.
- نفس الإصلاح يُطبّق على `adminUpsertPage` (custom pages).

---

## التقنيات
- ملفات جديدة: `src/lib/spend.server.ts`، `src/components/admin/ProviderCostTab.tsx`، `src/components/admin/FirecrawlMonitorTab.tsx`.
- migration واحد: `firecrawl_usage` (RLS admin-only)، `provider_rates` (admin-managed)، تحديث `app_settings` keys: `firecrawl_policy`.
- تعديل: `firecrawl.ts`، 7 ملفات API، 5 تبويبات إدارة، `admin.tsx`، `cms.functions.ts`، `content.ts`.

## الترتيب التنفيذي
1. Migration (firecrawl_usage + provider_rates).
2. `firecrawl.ts` كاش + حدود + خفض الافتراضي + تسجيل usage.
3. `spend.server.ts` + استبدال chargeTokens في API routes.
4. تبويبَا ProviderCost + FirecrawlMonitor + تحسين AdminLedgerPanel.
5. تعريب 5 تبويبات إدارة.
6. إصلاح الترجمة التلقائية + invalidateContent.
7. تشديد برومبتات الأدوات + `sources[]` + `rarity_score` + عرضها.
