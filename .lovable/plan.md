# تطوير بطاقات التحليل الثلاث الحالية لتشرح نفسها

## الهدف
نطوّر البطاقات الموجودة نفسها (السلطة، الصلة المحلية، احتمالية الاستشهاد) في أداة التحليل، ولا نضيف قسماً جديداً. الفراغ الحالي تحت الرقم والشريط يصبح سطرين يشرحان سبب الدرجة **لهذا النص بالذات**، وكيف يرفعها المستخدم، أو لماذا يستحقها إن كانت ممتازة. يُكتب الشرح بلغة التقرير المختارة (عربي/كردي/إنجليزي).

## ما يتغير في البطاقة
- درجة ضعيفة: ما الذي ينقص النص بالضبط ولماذا نقصت النقاط.
- درجة متوسطة: نقطة قوة واحدة ونقطة ضعف محددة.
- درجة ممتازة: المعايير التي تؤهله للاقتباس.
- بلا رصيد إضافي وبلا وقت إضافي: الشرح يخرج من نفس الفحص الحالي، لا من طلب جديد.
- النتائج القديمة المحفوظة تعرض شرحاً مبنياً من فحوصات النص الموجودة أصلاً في الأداة، فلا تبقى البطاقة فارغة.

## الشروط الصارمة
تطوير للموجود فقط: نفس البطاقة ونفس الفحص ونفس الطلب. لا تغيير في حساب الدرجات أو الأوزان أو التسعير أو إعادة الاستخدام. إذا لم يُرجع النموذج الشرح، تعمل البطاقة كما كانت.

## Technical details
- `src/routes/api/analyze.ts`: extend the existing JSON output schema in the same prompt with optional `explain: { authority, local, citation }` (each ≤ 160 chars, report language, must reference a concrete element of the text, no invented facts); parse into the existing `result`. Rubric/weights untouched.
- `src/components/Sandbox.tsx`: extend the existing `Metric` component with an optional `note` rendered under its bar; source = `result.explain` or fallback from existing `auditText` checks (src/lib/geo-audit.ts) mapped per metric.
- Typecheck + existing tests; nothing published.
