# إكمال ما تبقى من المرحلتين 1 و 2

البنية التحتية جاهزة (`tool-quality.server.ts`, `spend.server.ts`, `SourcesList.tsx`, `ProviderCostTab.tsx`, جداول `provider_rates` و`firecrawl_usage`). تم تطبيقها فعلياً فقط على `analyze.ts`. الباقي غير مكتمل.

## 1) بذور أسعار المزوّدين (هجرة بيانات)
إدراج صفوف في `provider_rates` (إن لم تكن موجودة):
- `lovable_ai` / `google/gemini-2.5-flash` / `per_1m_tokens` (دخل + خرج بصفّين منفصلين أو متوسط).
- `lovable_ai` / `google/gemini-2.5-pro`.
- `lovable_ai` / `openai/gpt-5-mini`.
- `firecrawl` / `per_credit`.
- `semrush` / `per_call`.
بدون أسعار = USD = 0 في كل اللوحات.

## 2) المرحلة 1 — تطبيق طبقة الأدلة على 7 مسارات
لكل من: `research.ts`, `compare.ts`, `suggest.ts`, `feasibility.ts`, `bizdev.ts`, `geo-strategist.ts`, `visibility.ts`:
- استدعاء `buildEvidencePack(query, { lang, ctx })` قبل LLM.
- لفّ system prompt بـ `qualityShell(...)`.
- حقن `pack.context_block` في رسالة المستخدم.
- توسيع الـ JSON schema المتوقع بـ `sources_used`, `rarity_score`, `uniqueness_notes`, `evidence_missing`.
- إرجاع `sources` للعميل ضمن الـ response.

## 3) تكامل `SourcesList` في مكوّنات الأدوات
إضافة `<SourcesList sources={...} sourcesUsed={...} rarityScore={...} uniquenessNotes={...} evidenceMissing={...} />` أسفل النتائج في:
`SmartResearch.tsx`, `CompetitorCompare.tsx`, `PostSuggester.tsx`, `FeasibilityStudy.tsx`, `BizDev.tsx`, `GeoStrategist.tsx`, `AIVisibility.tsx` (إضافة لـ `AppliedRanking` و`SocialAnalysis` و`WhatIfSimulator` لاحقاً عند تفعيل الأدلة لهم).

## 4) المرحلة 2 — استبدال `chargeTokens` بـ `recordSpend` في 9 مسارات
`research.ts`, `compare.ts`, `suggest.ts`, `feasibility.ts`, `bizdev.ts`, `geo-strategist.ts`, `visibility.ts`, `what-if.ts`, `applied-ranking.ts`, `brand-boost.ts`, `company-email.ts`, `social-analysis.ts`, `competitor-monitor.ts`, `brand-authority.ts`, `geo-rewrite.ts`:
- التقاط `usage` من استجابة Lovable AI (`prompt_tokens`, `completion_tokens`) + قياس latency.
- استدعاء `recordSpend({ userId, toolKey, provider:"lovable_ai", model, inputTokens, outputTokens, firecrawlUnits, latencyMs, endpoint, runId })` بدلاً من `chargeTokens`.

## 5) تنظيف عناصر صغيرة
- التحقق أن `firecrawl.ts` يستدعي `logFirecrawlSpend` (موجود بعد التعديل السابق) — مراجعة فقط.
- لا تغييرات RLS/سياسات.

## الملفات المتأثرة
- هجرة جديدة (1) — بذور `provider_rates`.
- تعديل ~16 ملف API + 7 مكوّنات أدوات.

## غير مشمول هذه المرة
- ربط `SourcesList` بأدوات لا تستخدم Firecrawl حالياً (سيُضاف في مرحلة لاحقة).
- تغييرات تصميمية للصفحات العامة (تمت سابقاً جزئياً).
