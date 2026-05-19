## الفكرة
بوابة Lovable AI لا توفّر Perplexity مباشرة — توفّر **Google Gemini** و **OpenAI GPT** فقط. لذلك نحوّل طبقة B إلى ما يلي:

| المنصّة | المصدر | الحالة |
|---|---|---|
| Gemini | Lovable Gateway → `google/gemini-3-flash-preview` | **مقاسة فعلياً** |
| ChatGPT | Lovable Gateway → `openai/gpt-5-mini` | **مقاسة فعلياً** (وكيل لعائلة GPT/ChatGPT) |
| Perplexity, Claude, Grok, Copilot, DeepSeek, Mistral | مستنتجة من طبقة الأدلة الحقيقية (Firecrawl) | مستنتجة بوضوح |

النتيجة: منصّتان من الـ8 تنتقلان من «مستنتج» إلى «مقاس فعلياً» بدون أي مفتاح إضافي من المستخدم.

## ما سيُنفّذ

1. **`src/lib/platform-probe.server.ts` (جديد)**
   - دالّة `probeGemini(brand, lang)` و `probeChatGPT(brand, lang)` تُرسل سؤالاً موحّداً («ماذا تعرف عن `<brand>`؟ اذكر مصادر وحقائق») عبر Lovable Gateway.
   - تحسب درجة ظهور 0-100 من: طول الإجابة الواقعية، ذِكر اسم العلامة، استشهاد URLs، تأكيد المعرفة vs «لا أعرف».
   - تُعالج 402/429 بإرجاع `null` (تسقط بصمت إلى الاستنتاج).

2. **`src/routes/api/compare.ts`**
   - استدعاء `probeGemini` و `probeChatGPT` لكل علامة بالتوازي.
   - عند توفّر نتيجة → استبدال قيمة المنصّة في `platform_presence` بالقيمة المقاسة وتعليمها بـ `measured: true`.
   - عند الفشل → الإبقاء على القيمة المستنتجة الحالية.
   - إضافة حقل `platform_measured: Record<string, string[]>` (لكل علامة قائمة المنصّات المقاسة).

3. **`src/components/CompetitorCompare.tsx`**
   - بجانب كل شريط منصّة، شارة صغيرة:
     - `● مقاس` (أخضر) للمنصّات المقاسة فعلياً (Gemini, ChatGPT).
     - `○ مستنتج` (رمادي) للباقي.
   - تحديث بطاقة «كيف تُحسَب المؤشرات» لتعكس أنّ منصّتين أصبحتا مقاستين عبر بوابة Lovable.

4. **`src/lib/i18n.tsx`**
   - مفاتيح جديدة بالعربية/الإنجليزية/الكردية: `platform_measured`, `platform_inferred`, `compare_how_platforms_v2`.

## الملاحظات
- لا حاجة لأي مفتاح من المستخدم — `LOVABLE_API_KEY` مهيّأ تلقائياً.
- التكلفة: استدعاءان لكل علامة (Gemini + GPT) — لـ 5 علامات = 10 طلبات لكل تشغيل (مقبولة، Gemini Flash و GPT-mini رخيصان).
- وقت إضافي ~2-4 ثوانٍ لكل تشغيل (متوازٍ).
- إذا أراد المستخدم لاحقاً تفعيل Perplexity حقيقياً، يكفي إضافة الموصّل وسأضيف `probePerplexity` بنفس النمط.

هل أُنفّذ؟