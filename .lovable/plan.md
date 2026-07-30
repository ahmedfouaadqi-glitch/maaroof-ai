## الجزء 8 — Laws of Cognitive Intelligence (طبقة الامتثال الدستوري)

### لماذا تطوير وليس إنشاء
القوانين الثلاثين ليست محرّكات جديدة — 26 منها مُنفّذ فعلاً داخل المنسّق الحالي (`src/lib/maaroof/orchestrator.server.ts`): Envision (قانون 3/30)، Memory recall قبل الأدوات (11)، Expert Council (12)، Trust Engine (13/7)، Timing (14)، Quality Score (8)، Personality/Genome (18)، Execution Modes + needs_human (21/24)، decision_log (22/23)، `cognitive_consent` + `scope` في الذاكرة (16/17)، Capability OS (5)، Agent Factory (6).

لذلك لا نبني محرّكًا جديدًا. نبني **طبقة قياس وإلزام (Compliance Layer)** تقرأ الإشارات الموجودة أصلاً وتحكم عليها، وتحقن القوانين في التعليمات، وتوقف الإجابة عند خرق قانون حرج — دون أي طلب LLM إضافي.

### 1) سجل القوانين — ملف واحد جديد
`src/lib/maaroof/laws.server.ts`
- `LAWS`: 30 قانونًا (`id`, `key`, `ar`, `en`, `phase`, `severity: hard|soft`, `evidence`).
- `evaluateLaws(signals)` → `{ score, verdict, violations[], satisfied[] }` حيث `signals` مبنيّة كلها من متغيّرات المنسّق القائمة (envision, memories.length, councilOpinions, trust, timing, qualityScore, totalUsd, consent, workspaceId, decisionLog, finalText).
- `lawsPromptBlock()` → كتلة مختصرة تُضاف إلى `effectivePrompt` بجانب Personality/Genome (نفس مكان الحقن الحالي، لا مسار جديد).
- **صفر تكلفة**: كل التقييم استدلالي محلي.

### 2) الإلزام (Hard Laws)
عند تفعيل `enforce_hard_laws`، وقبل بث `final`:
- **قانون 13 (Trust before answer)**: إذا كانت ثقة المجلس/الأدلة تحت العتبة → تُعرض الإجابة موسومة «ثقة منخفضة» مع سؤال توضيحي بدل تقديمها كقرار نهائي.
- **قانون 26 (No hallucination)**: إذا لم توجد أي أدلة (لا ذاكرة ولا نتائج أدوات) → إعلان صريح بنقص المعلومة.
- **قانون 17 (Workspace isolation)**: تأكيد أن الاستدعاء تمّ ضمن نطاق المساحة قبل التلخيص إلى الذاكرة.
لا شيء من هذا يعمل ما لم يُفعّل المفتاح.

### 3) الإعدادات — توسيع لا إنشاء
في `src/lib/maaroof/settings.server.ts` تُضاف مجموعة `laws` إلى `MaaroofSettings` بنفس نمط المجموعات السابقة:
`{ enabled: false, enforce_hard_laws: false, prompt_injection: false, min_trust: 55, log_compliance: true }` — كلها OFF افتراضيًا، فالسلوك الحالي يبقى مطابقًا حرفيًا.

### 4) قاعدة البيانات — عمود واحد
Migration: `ALTER TABLE public.maaroof_runs ADD COLUMN IF NOT EXISTS compliance jsonb;`
لا جداول جديدة، لا سياسات جديدة (سياسات `maaroof_runs` الحالية تغطيه). سيتم إضافة عرض `law_compliance_v` للتجميع الإداري فقط (قراءة للأدمن).

### 5) المنسّق — 3 نقاط حقن فقط
`src/lib/maaroof/orchestrator.server.ts`
- عند بناء `effectivePrompt` (≈السطر 236): إضافة `lawsPromptBlock()` خلف المفتاح.
- قبل بث `final` (≈السطر 564–592): تقييم القوانين على الإشارات المجمّعة، بثّ حدث SSE جديد `compliance`، وتطبيق الـHard Laws إن فُعّلت.
- بعد الحفظ (≈السطر 622): `update({ compliance })` ضمن نفس عملية التحديث القائمة — لا استعلام إضافي.

### 6) الواجهات
- `src/components/maaroof/MaaroofStage.tsx`: بطاقة «الامتثال الدستوري» — نتيجة مئوية + شارات القوانين المخروقة (عربي)، تظهر فقط عند وصول حدث `compliance`.
- `src/components/admin/MaaroofAdminTab.tsx`: مفاتيح مجموعة `laws` ضمن قسم المفاتيح التنفيذية القائم.
- `src/components/admin/MaaroofIntelligenceCenter.tsx`: لوحة «أكثر القوانين خرقًا» من `law_compliance_v`.

### 7) التوثيق والتدقيق
`docs/MAAROOF-AUDIT.md`: قسم الجزء 8 يوثّق خريطة كل قانون → المكوّن القائم الذي ينفّذه، وسبب اختيار التطوير بدل الإنشاء، وحالة التوافق الرجعي لكل ملف مُعدّل.

### التوافق الرجعي
كل المفاتيح OFF افتراضيًا ⇒ المسار التنفيذي للجزء 7 يبقى كما هو بايت-بايت. لا حذف، لا إعادة تسمية، لا جداول أو خدمات مكرّرة.

### الأجزاء اللاحقة
9 حتى 17 تُنفَّذ جزءًا واحدًا في كل دورة بعد اعتماد هذا الجزء.