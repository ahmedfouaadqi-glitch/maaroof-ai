
# خطة تطوير معروف — Executive AI OS (الجزء 1)

مبدأ حاكم: **طوّر لا تستبدل**. لا نُنشئ جدولاً/API/مكوّناً جديداً ما لم يكن الموجود عاجزاً كلياً. كل خطوة توثَّق في `docs/MAAROOF-AUDIT.md`.

## المرحلة 0 — تدقيق قبل التنفيذ (لا كود)

تحديث `docs/MAAROOF-AUDIT.md` بجدول مقارنة لكل مكوّن مطلوب في الدستور مقابل ما هو قائم:

| مطلوب الدستور | القائم اليوم | القرار |
|---|---|---|
| Capability Registry | `src/lib/tool-catalog.ts` (قائمة أدوات + خطط) | **يُطوَّر** — إضافة حقول قدرات |
| Expert Council | `orchestrator.server.ts` (Plan-Act-Reflect مفرد) | **يُطوَّر** — طبقة نقاش داخلية |
| Living Memory | `maaroof_memory` (LRU + importance) | **يُطوَّر** — إضافة روابط ونوع "knowledge" |
| Sub Agents | `parent_run_id` موجود بالفعل | **يُستخدم كما هو** |
| Decision Intelligence | لا يوجد سجل قرارات مستقل | **يُضاف عبر تطوير `maaroof_runs`** (عمود `decision_log jsonb`) |
| Cost System | `token_ledger` + `chargeTokens` | **يُستخدم كما هو** |
| Workspaces | جدول `workspaces` قائم | **يُستخدم كما هو** |

مخرج المرحلة: قسم جديد في ملف التدقيق باسم "Constitution Compliance Matrix".

## المرحلة 1 — Capability Registry (تطوير `tool-catalog.ts`)

بدل جدول جديد، نضيف إلى نفس الملف حقولاً لكل أداة:
```ts
capabilities: Capability[]     // ["competitor_analysis","seo","forecasting",...]
strengths: string[]
weaknesses: string[]
preferred_models: string[]
cost_profile: "light"|"medium"|"heavy"
```
+ دالة `findExpertsByCapability(cap)` تُستخدم من الأوركستريتور بدل `tool by name`.
- **لا جدول DB جديد** (المعلومات ثابتة إعلانية).
- تحديث `MaaroofAdminTab` لعرض المصفوفة (قراءة فقط) لتأكيد عدم التكرار.

## المرحلة 2 — Expert Council (تطوير الأوركستريتور)

داخل `src/lib/maaroof/orchestrator.server.ts` نضيف مرحلة `deliberate()` قبل `act()`:
1. `plan()` كما هو → يُنتج مهمة.
2. **جديد**: `council()` — لكل capability مطلوبة نستدعي "خبير" (نداء LLM موجز بشخصية الأداة) لإبداء الرأي/الاعتراض.
3. `decide()` — يُلخّص معروف الآراء ويختار الخطة النهائية ويكتبها في `decision_log`.
4. `act()` و `reflect()` كما هو.

- كل خبير عبارة عن **بيانات** (DNA من tool-catalog) + قالب برومبت — بلا جداول/APIs جديدة.
- إعداد "kill switch" و "council depth" في `maaroof_settings` القائم (عمود jsonb `council` جديد).

## المرحلة 3 — Living Memory (تطوير `maaroof_memory`)

- إضافة أعمدة عبر migration واحدة: `links jsonb`, `source_run_id uuid`, `capability text`, `embedding` (اختياري لاحقاً).
- تحديث `memory.server.ts`: `recall` تُرجّح حسب `capability` المطلوبة + last_accessed + importance.
- نوع جديد ضمن `MemoryKind`: `"knowledge"` (حقائق مستدامة) و `"decision"` (قرارات مجلس).
- عرض في `/maaroof.memory` مع فلاتر بحسب capability.

## المرحلة 4 — Decision Intelligence

- Migration: `ALTER TABLE maaroof_runs ADD COLUMN decision_log jsonb DEFAULT '[]'`.
- الأوركستريتور يكتب كل قرار (خيار، رأي مجلس، سبب، تكلفة متوقعة).
- تبويب `MaaroofAdminTab` يضيف قسم "Decision Audit" مع تصدير CSV (يُعيد استخدام `ExportButtons`).

## قواعد التنفيذ

- كل PR في هذه الخطة يبدأ بقراءة الملف الهدف كاملاً وتوثيق "ما القائم" قبل التعديل.
- لا جداول جديدة عدا `ALTER` على القائم.
- لا مسارات API جديدة — `/api/maaroof` القائم يستضيف كل التحسينات.
- بعد كل مرحلة: قسم "Audit after implementation" في `docs/MAAROOF-AUDIT.md`.

## خارج النطاق الآن (ينتظر الأجزاء 2+)

Hybrid MCP للمستخدم النهائي، Future-Driven Engine، Knowledge Graph بـ embeddings، Platform Intelligence — نتناولها عند وصول بقية أجزاء الدستور.

---
عند الموافقة أبدأ بالمرحلة 0 (تحديث ملف التدقيق) ثم المرحلة 1.
