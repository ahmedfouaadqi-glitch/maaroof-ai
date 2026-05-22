# تغيير نموذج AI في أداة مقارنة المنافسين

## الهدف
تقليل تكلفة استدعاءات AI عبر استبدال النموذج المستخدم بأرخص وأحدث نموذج موصى به (`google/gemini-3-flash-preview`) بدلاً من `google/gemini-2.5-flash`. **بدون أي كاش** — كل مستخدم يحصل على تحليل حقيقي طازج في كل مرة، ولا يرى أي إشارة "cached" في الواجهة.

## التغييرات

### 1. `src/routes/api/compare.ts` (سطر 309 و 387)
استبدال:
- `let resp = await callModel("google/gemini-2.5-flash");`
- `model: "google/gemini-2.5-flash",`

إلى:
- `let resp = await callModel("google/gemini-3-flash-preview");`
- `model: "google/gemini-3-flash-preview",`

### 2. `src/lib/platform-probe.server.ts` (سطر 204)
استبدال:
- `const model = opts.model || "google/gemini-2.5-flash";`

إلى:
- `const model = opts.model || "google/gemini-3-flash-preview";`

## النتيجة
- نفس جودة التحليل (النموذجان متقاربان جداً في الأداء).
- تكلفة أقل لكل استدعاء AI → رصيدك يكفي لاستدعاءات أكثر.
- لا تغييرات في الواجهة، ولا كاش، ولا أي شيء يلاحظه المستخدم.

## الملفات المعدّلة
- `src/routes/api/compare.ts`
- `src/lib/platform-probe.server.ts`
