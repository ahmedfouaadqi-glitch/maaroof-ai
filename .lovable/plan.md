# خطة إصلاح أداة مقارنة المنافسين

## المشاكل المكتشفة

1. **نقاط القوة/الضعف فارغة**: في `src/routes/api/compare.ts` (سطر 289-304)، `deriveStrengthsWeaknesses` ترجع مصفوفات فارغة عندما لا يوجد `seo` (لم يُحدَّد رابط ولم يُكتشف موقع رسمي) و لا يوجد أدلة كافية. كذلك `found.strengths`/`weaknesses` من النموذج تكون فارغة عند فشل JSON. النتيجة: لا يظهر شيء.
2. **تقييمات المنصات الـ 8 غير صحيحة**: `derivePlatformPresence` تعطي قاعدة 15 فقط بدون أدلة، فتتقارب الأرقام عند ~15-20 لجميع المنصات. كما أن `probePlatforms` تُحدِّث Gemini و ChatGPT فقط، تاركة 6 منصات بقيم وهمية.
3. **استهلاك الرصيد**: المسار يستدعي حالياً `gemini-2.5-pro` ثم `probePlatforms` (موديلان × 5 علامات = حتى 10 استدعاءات إضافية) → يستهلك أكثر من 10 credits لكل تشغيل.

## التغييرات

### 1) `src/routes/api/compare.ts` — تقليل الرصيد + إصلاح المنطق
- استبدال `google/gemini-2.5-pro` بـ `google/gemini-2.5-flash` (استدعاء واحد رخيص).
- استبدال probe لكل علامة بـ **استدعاء واحد مجمَّع** (`gemini-2.5-flash` فقط) يسأل عن جميع العلامات دفعة واحدة ويعيد JSON: `{ brand: { gemini, chatgpt, claude, perplexity, copilot, grok, mistral, deepseek } }`. النموذج يقدّر مدى احتمال معرفة كل محرك بالعلامة بناءً على الأدلة المرفقة. هذا = استدعاء AI واحد فقط للمنصات (بدلاً من 10).
- نتيجة إجمالية: **استدعاءان AI فقط** لكل تشغيل (تحليل + منصات) → ضمن حد ~2-5 credits.
- ضمان عدم بقاء `strengths`/`weaknesses` فارغة: إذا لم تنتج `deriveStrengthsWeaknesses` ولا النموذج أي شيء، أضف عناصر افتراضية محسوبة من الأدلة (مثلاً: `sw_strong_official_site` إذا وُجد موقع، وإلا `sw_weak_no_official_site` + `sw_weak_no_evidence`)، بحيث لا تُترك أي بطاقة بدون مؤشرات.
- تحسين `derivePlatformPresence` (في `seo-sge.server.ts`) ليعطي طيفاً واقعياً حتى بدون SEO عبر زيادة وزن evidenceByKind وتغيير الـ base ليعكس الأدلة لكل محرك بشكل مختلف بدل قاعدة موحَّدة منخفضة.

### 2) `src/lib/platform-probe.server.ts` — استبدال
- استبدال `probePlatforms` بـ `probeAllPlatformsBatch(brandsWithEvidence, lang, market, apiKey)`: استدعاء واحد لـ `gemini-2.5-flash` يُرجع تقييمات الـ 8 محركات لكل علامة، مع تعليمات صارمة للنموذج بإصدار JSON فقط.
- إزالة استدعاء `gpt-5-mini` نهائياً لتقليل التكلفة.

### 3) `src/components/CompetitorCompare.tsx` — لا تغيير منطقي
- يبقى كما هو؛ يعرض المعلومات الجديدة تلقائياً (الـ keys `sw_*` موجودة في i18n).

## ملاحظات تقنية
- `platform_measured` سيشمل المنصات الـ 8 جميعها (وليس gemini/chatgpt فقط) لأن جميعها مقدَّرة من نفس استدعاء AI الواحد المبني على الأدلة.
- في حال فشل استدعاء المنصات، يتم الرجوع إلى `derivePlatformPresence` (deterministic) كما هو الآن.

## ملفات ستُعدَّل
- `src/routes/api/compare.ts`
- `src/lib/platform-probe.server.ts`
- `src/lib/seo-sge.server.ts` (تحسين بسيط في `derivePlatformPresence`)
