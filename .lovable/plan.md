# خطة الإكمال — المرحلتان 1 و 2

أكملنا سابقاً: Firecrawl monitoring + cache + سياسات، تعريب تبويبات الإدارة، إصلاح الترجمة التلقائية في CMS.
الآن نُكمل الجزأين المتبقيين من طلبك السابق.

---

## المرحلة 1 — جودة الأدوات: "نادر، مميز، حقيقي"

**الهدف:** منع المخرجات العامة/المُختلَقة وإلزام كل أداة بمصادر حقيقية.

### تغييرات على البنية المشتركة
- إضافة `src/lib/tool-quality.server.ts`:
  - `buildEvidencePack(query, scope)` → يستدعي `fcSearch` + `fcScrape` للنتائج العليا ويعيد `sources[]` (url, title, snippet, fetched_at).
  - `assertEvidence(sources, minCount=2)` → يرمي خطأً واضحاً لو لم تتوفر أدلة كافية، لتجبر النموذج على وضع `evidence_missing: true` بدلاً من تأليف أرقام.
  - `qualityShell(prompt)` → يحقن في كل برومبت:
    - "استخدم فقط الحقائق من `sources` المُرفقة."
    - "كل ادعاء رقمي يحتاج `source_index`."
    - أخرِج `rarity_score (0-100)` و `uniqueness_notes` و `evidence_missing`.

### تكامل مع 8 مسارات أساسية
`analyze.ts`, `research.ts`, `compare.ts`, `suggest.ts`, `feasibility.ts`, `bizdev.ts`, `geo-strategist.ts`, `visibility.ts`:
- استدعاء `buildEvidencePack` قبل LLM.
- تمرير `sources[]` ضمن الـ payload للنموذج وإلزام JSON schema بـ `sources_used: number[]` و `rarity_score`.
- إذا `evidence_missing` → الواجهة تعرض بانر "تحتاج رابط/بيانات إضافية" بدلاً من نتيجة وهمية.

### مكوّن واجهة جديد
`src/components/SourcesList.tsx` — يعرض المصادر المستخدمة كروابط قابلة للنقر مع snippet ووقت السحب، وشارة `Rarity 87/100` بجانب العنوان.
يُدمج تحت نتائج الأدوات الثماني أعلاه.

### تحسينات صفحات الموقع العامة
- `index.tsx`, `guide.tsx`, `pricing.tsx`: استبدال أي نص "lorem-style" بمحتوى مدفوع من `site_content` فقط (لا fallback عام).

---

## المرحلة 2 — تتبع التكلفة الحقيقية لكل توكن/طلب/مستخدم

### قاعدة البيانات (هجرة جديدة)
- توسيع `token_ledger.meta` (موجود JSONB) بحقول قياسية موثّقة: `provider`, `model`, `input_tokens`, `output_tokens`, `firecrawl_units`, `latency_ms`, `endpoint`, `request_id`.
- جدول `provider_rates` موجود — نضيف بذور:
  - Lovable AI: `google/gemini-2.5-flash`, `gemini-2.5-pro`, `gpt-5-mini` (USD لكل 1M توكن دخل/خرج).
  - Firecrawl: USD لكل credit.
  - Semrush: USD لكل call.

### طبقة قياس مركزية
`src/lib/spend.server.ts`:
```ts
recordSpend({ userId, toolKey, provider, model, inputTokens, outputTokens,
              firecrawlUnits, latencyMs, endpoint, runId })
```
- يقرأ `provider_rates` ويحسب `usd_cost` الحقيقي.
- يستدعي `charge_tokens` RPC مع `_meta` غني.
- يرجع `{ tokens, usdCost, breakdown }`.

استبدال كل `charge_tokens` المباشر في 10 مسارات API بـ `recordSpend()`.

### تبويب إدارة جديد: "تكلفة المزوّدين"
`src/components/admin/ProviderCostTab.tsx`:
- بطاقات: إجمالي USD اليوم/الشهر، متوسط تكلفة الطلب، هامش (مدفوع - تكلفة).
- جدول لكل مستخدم: عدد الطلبات، توكنات الدخل/الخرج، USD، توزيع المزوّدين.
- جدول لكل أداة: نفس الأعمدة + متوسط الزمن.
- جدول آخر العمليات (100 صف) مع `request_id` وفلتر زمني.
- تصدير CSV.

تعريب كامل عبر `useAdminL` (ar/en/ku).

### تكامل مع `firecrawl.ts`
- بعد كل عملية، إضافة `firecrawl_units` للـ ledger الرئيسي عبر `recordSpend` (بالإضافة إلى `firecrawl_usage` المخصص للمراقبة).

---

## الملفات

**جديد (5):**
- `src/lib/tool-quality.server.ts`
- `src/lib/spend.server.ts`
- `src/components/SourcesList.tsx`
- `src/components/admin/ProviderCostTab.tsx`
- هجرة بذور `provider_rates` + توثيق `token_ledger.meta`.

**تعديل (~14):**
- 8 مسارات API (Phase 1 + spend)
- `src/lib/firecrawl.ts` (spend hook)
- `src/routes/admin.tsx` (تسجيل التبويب)
- مكوّنات الأدوات الثماني لعرض `SourcesList` و `rarity_score`

## ملاحظات
- لا تغييرات على RLS أو السياسات الأمنية القائمة.
- لا تأثير على المستخدمين الحاليين — المصادر تظهر فقط عند توفرها.
- التكاليف ستبدأ بالظهور للطلبات الجديدة فور النشر؛ السجلات القديمة تبقى كما هي.
