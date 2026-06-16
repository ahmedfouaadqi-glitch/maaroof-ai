# ما تبقّى غير مكتمل

بعد المراجعة الفعلية للملفات وقاعدة البيانات:

| البند | الحالة |
|---|---|
| جدول `provider_rates` (أسعار Gemini / Firecrawl / Semrush) | ✅ مكتمل — البذور موجودة |
| `enrichLedger` / تسجيل تكلفة USD الحقيقية في 13 مسار API | ✅ مكتمل |
| مراقبة Firecrawl + `logFirecrawlSpend` | ✅ مكتمل |
| تعريب لوحة الإدارة (الهيدر/الرؤى/الذكاء/التصدير/تكلفة المزوّدين) | ✅ مكتمل |
| **طبقة الأدلة (Evidence Layer) في مسارات API** | ❌ صفر مسارات — البنية التحتية فقط جاهزة |
| **ربط `SourcesList` في مكوّنات الأدوات** | ❌ صفر مكوّنات |

## الخطة

### 1) تطبيق طبقة الأدلة على 7 مسارات API
لكل من: `research.ts`, `compare.ts`, `suggest.ts`, `feasibility.ts`, `bizdev.ts`, `geo-strategist.ts`, `visibility.ts`:
- استدعاء `buildEvidencePack(query, { lang, ctx })` من `src/lib/tool-quality.server.ts` قبل نداء LLM.
- لفّ الـ system prompt بـ `qualityShell(...)`.
- حقن `pack.context_block` في رسالة المستخدم.
- توسعة الـ JSON schema المتوقع لتشمل: `sources_used`, `rarity_score`, `uniqueness_notes`, `evidence_missing`.
- إرجاع `sources` ضمن الاستجابة للعميل.

### 2) ربط `SourcesList` في مكوّنات الأدوات
إضافة `<SourcesList sources={result.sources} sourcesUsed={result.sources_used} rarityScore={result.rarity_score} uniquenessNotes={result.uniqueness_notes} evidenceMissing={result.evidence_missing} />` أسفل النتائج في:
`SmartResearch.tsx`, `CompetitorCompare.tsx`, `PostSuggester.tsx`, `FeasibilityStudy.tsx`, `BizDev.tsx`, `GeoStrategist.tsx`, `AIVisibility.tsx`.

### 3) ضبط استهلاك Firecrawl ضمن الطبقة
- تثبيت سقف `limit: 4` افتراضياً في `buildEvidencePack` (محدّد فعلاً) للحدّ من credits.
- استخدام `fcSearch` فقط (بدون scrape) — يكفي للاستشهاد بالعناوين/المقتطفات.

## الملفات المتأثرة
- تعديل 7 ملفات API في `src/routes/api/`.
- تعديل 7 مكوّنات في `src/components/`.
- لا هجرات قاعدة بيانات، لا تغييرات RLS.

## غير مشمول
- ربط `SourcesList` بـ `AppliedRanking`/`SocialAnalysis`/`WhatIfSimulator` (تبقى مرحلة لاحقة عندما تُفعَّل لهم الأدلة).
- أي تغييرات تصميمية للواجهة العامة.
