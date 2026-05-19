## المشكلة
في `src/routes/api/compare.ts` نقاط القوة/الضعف تُؤخذ مباشرة من ردّ النموذج (`found.strengths`, `found.weaknesses`)، فيُولّدها بصياغة عامة حتى عند وجود موقع رسمي — لأن الأدلّة الحقيقية (تقرير `seo_sge`، شارات Firecrawl، درجات المنصّات المقاسة) لا تُغذّى لاستخراجها.

## الحل
اشتقاق نقاط القوة/الضعف **حتمياً من نفس الإشارات الحقيقية** التي نجمعها الآن، بدون أي مفتاح إضافي.

## التنفيذ

### 1) `src/lib/seo-sge.server.ts` (إضافة دالة)
```ts
deriveStrengthsWeaknesses({
  brand, seo, evidenceByKind, totalEvidence,
  hasOfficialSite, platformMeasured,
}) => { strengths: string[]; weaknesses: string[] }
```
يُرجع **مفاتيح i18n** (لا نصوص ثابتة) مبنية على:

| الإشارة → نقطة قوة | الإشارة → نقطة ضعف |
|---|---|
| `seo.signals.has_jsonld` + `has_org_schema` | غياب JSON-LD أو Organization schema |
| `seo.signals.word_count ≥ 800` | محتوى ضعيف (< 300 كلمة) |
| `seo.signals.has_faq_schema` | غياب FAQ schema (مهم لـ SGE) |
| `has_og` + `has_twitter` | غياب Open Graph |
| نسبة `images_with_alt ≥ 0.7` | نقص alt على الصور |
| `internal_links ≥ 10` | روابط داخلية شحيحة |
| `external_links ≥ 5` (يدعم Perplexity/Claude) | لا استشهادات خارجية |
| `evidenceByKind.news ≥ 3` (تغطية إخبارية) | لا تغطية إخبارية في السوق |
| `evidenceByKind.reviews ≥ 3` | لا مراجعات/تقييمات منظورة |
| `evidenceByKind.geo ≥ 2` (حضور جغرافي) | لا إشارات حضور جغرافي محلي |
| `hasOfficialSite` (موقع موثّق) | لم يُكتشف موقع رسمي |
| `platformMeasured.gemini ≥ 60` ظهور قوي في Gemini | ظهور ضعيف في Gemini/ChatGPT المقاس |
| `has_canonical` + `has_lang` + `has_viewport` كاملة | نقص تهيئة تقنية أساسية |

يُرتّب القائمتين حسب الأهمية ويُقتطعان لـ 4 عناصر كحد أقصى.

### 2) `src/routes/api/compare.ts`
- بعد بناء `pp` و `seo` و `platformMeasured` لكل علامة، استدعاء `deriveStrengthsWeaknesses(...)`.
- استبدال:
  ```ts
  strengths: arr(found.strengths, 4),
  weaknesses: arr(found.weaknesses, 4),
  ```
  بـ:
  ```ts
  const sw = deriveStrengthsWeaknesses({ ... });
  strengths: sw.strengths,           // مفاتيح i18n حتمية من الأدلّة
  weaknesses: sw.weaknesses,
  ```
- في حال غياب أي إشارة (لا موقع رسمي + 0 أدلّة) نُبقي على ردّ النموذج كاحتياط مع وسم `inferred`.

### 3) `src/lib/i18n.tsx`
إضافة المفاتيح الـ ~24 (قوة/ضعف) بالعربية/الإنجليزية/الكردية، مثل:
- `sw_strong_schema` = "بنية بيانات منظمة كاملة (JSON-LD + Organization)"
- `sw_weak_thin_content` = "محتوى ضعيف على الموقع الرسمي (أقل من 300 كلمة)"
- `sw_strong_news_coverage` = "تغطية إخبارية واضحة في السوق المستهدف"
- `sw_weak_no_official_site` = "لم يُعثر على موقع رسمي موثّق"
- … إلخ.

### 4) `src/components/CompetitorCompare.tsx`
- عند عرض كل عنصر strengths/weaknesses: إن كان النص يبدأ بـ `sw_` نمرّره عبر `t()`، وإلا نعرضه كما هو (الـ fallback من النموذج).
- إضافة شارة صغيرة `● مقاسة من أدلّة الموقع` على بطاقة نقاط القوة/الضعف لتوضيح أنها حتمية لا تخمينية.

## النتيجة
- نقاط القوة/الضعف تصبح **منعكسة فعلياً عن محتوى الموقع وروابطه وأدلّة البحث** — متى أضاف المستخدم رابطاً، تتغيّر القائمة فوراً بناءً على ما اكتُشف.
- لا حاجة لأي مفتاح API جديد. يعتمد فقط على Firecrawl (الموجود) و Lovable Gateway (المهيّأ).
- النصّ النموذجي يبقى احتياطاً عند انعدام الإشارات.

موافق على التنفيذ؟
