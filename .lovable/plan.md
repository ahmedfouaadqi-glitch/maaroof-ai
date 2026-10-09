# شرح ديناميكي داخل بطاقات التحليل الثلاث

## الهدف
تحت رقم وشريط كل بطاقة (السلطة، الصلة المحلية، احتمالية الاستشهاد) في أداة التحليل يظهر سطران يشرحان سبب هذه الدرجة **لهذا النص بالذات**، وكيف يرفعها المستخدم — أو لماذا يستحقها إن كانت ممتازة. يُكتب الشرح بلغة التقرير المختارة (عربي/كردي/إنجليزي).

## ما يراه المستخدم
- درجة ضعيفة: ما الذي ينقص النص بالضبط ولماذا نقصت النقاط.
- درجة متوسطة: نقطة قوة واحدة ونقطة ضعف محددة.
- درجة ممتازة: المعايير التي تؤهله للاقتباس.
- بلا رصيد إضافي وبلا وقت إضافي: الشرح يأتي ضمن نفس الفحص.
- النتائج القديمة المحفوظة (بلا شرح) تعرض سطراً احتياطياً يُبنى محلياً من فحوصات النص الموجودة، فلا تبقى البطاقة فارغة.

## الشروط الصارمة
إضافة فقط: لا تغيير في طريقة حساب الدرجات أو الأوزان أو التسعير أو إعادة الاستخدام. إذا لم يُرجع النموذج الشرح، تعمل الأداة كما هي.

## Technical details
- `src/routes/api/analyze.ts`: add optional `explain: { authority, local, citation }` (each ≤ 160 chars, report language, must cite a concrete element from the text, no invented facts) to the JSON schema in the prompt; parse with string clamp; include in `result`. Scoring rubric untouched.
- `src/components/Sandbox.tsx`: `Metric` gets optional `note` prop rendered as small muted text under the bar; pass `result.explain?.x` or fallback from `auditText` (src/lib/geo-audit.ts) failed/passed checks mapped per metric.
- Also apply to rewrite result type as optional (no UI change required).
- Typecheck + existing tests; nothing published.
