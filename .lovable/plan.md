
# Prompt 19 — Parts 2 to 7: تطوير لا إنشاء

## تقييم الموجود أولاً (مؤكَّد بالقراءة)

| المطلوب في الأجزاء 2–7 | الموجود فعلاً اليوم | القرار |
|---|---|---|
| Reality Execution Engine (REE) | `workflow.server.ts` (رسم بياني + عقد + انتقالات)، `maaroof_schedules`، `agent_tasks`، `hermes_tasks` + `hermes_task_events`، `capability.server.ts` لاختيار الأدوات، `models.server.ts` لاختيار النماذج | **تطوير**: طبقة تنفيذ موحّدة فوق الموجود، لا محرك جديد |
| Reality Verification Engine (RVE) | `trust.server.ts` (13 مرحلة)، `reality.server.ts` (تصنيف + أدلة)، `laws.server.ts` (30 قانون)، `decisions.server.ts` | **دمج**: RVE = واجهة تحقق واحدة تستدعي هذه الطبقات بترتيب دستوري |
| Evidence Engine | جدول `evidence_items` موجود بحقول مختصرة | **توسعة الجدول** لا استبداله |
| Cross Validation + Benchmark | `ai_model_benchmarks`، `expert_snapshots`، `capability_scores_v` | **توسعة** لتشمل مقارنة عبر المصادر والزمن |
| Reality Lab | لا يوجد جدول تجارب | **جديد فعلاً** (`lab_experiments` + `lab_runs`) لكنه يقرأ من المحركات الموجودة |
| HERMES EOS | `hermes.server.ts` (742 سطر: مرصد، اقتراحات، محادثة، مهام، تقارير، DNA للمؤسس) | **توسعة**: مهام تنفيذية مرتبطة بـ REE + غرفة قرار + تقارير دورية |
| Part 7 التدقيق النهائي | `laws.server.ts`، `system-health.functions.ts`، `MaaroofIntelligenceCenter` | **تطوير**: مُدقِّق معماري + Atlas + تقرير جاهزية داخل نفس اللوحة |

**سبب اختيار التطوير**: كل مفاهيم الأجزاء 2–7 لها نظائر عاملة الآن؛ إنشاء محركات موازية سيُكرّر البيانات ويكسر التوافق الخلفي الذي يفرضه الدستور. لذلك كل جزء يُنفَّذ كـ«طبقة تنسيق» تقرأ وتكتب في الجداول القائمة.

## الموجة 1 — REE + Evidence/Benchmark

**قاعدة البيانات** (هجرة واحدة، مع GRANT + RLS لكل جدول جديد):
- `executions` — هدف، استراتيجية، خطة، حالة، مالك، مساحة عمل، تكلفة، توكنز، نتيجة مقاسة، ربط بـ `maaroof_runs`
- `execution_tasks` — مهمة، قدرة مطلوبة، خبير، وكيل، نموذج، MCP، حالة، محاولات، مخرجات
- `execution_events` — سجل مراقبة زمني (append-only)
- توسعة `evidence_items` بأعمدة: `title, category, evidence_type, source_reliability, collection_method, workspace_id, expert_key, execution_id, language, expires_at, freshness, business_value, verification_history jsonb`
- `benchmarks` + `benchmark_results` — مقارنة نتيجة مقابل خط أساس/منافس/تاريخ

**الكود**:
- `src/lib/maaroof/execution.server.ts` — خط الأنابيب: goal → plan → tasks → capability/expert/model mapping (يستدعي `capability.server.ts` و `models.server.ts` و `experts.server.ts` الموجودة) → run → measure → evidence → reality validate (`classifyReality`) → knowledge/trust update (`closeRealityLoop`) → تقرير
- `src/lib/maaroof/evidence.server.ts` — إنشاء/تصنيف/ترجيح/انتهاء صلاحية الأدلة + `crossValidate()` عبر مصادر متعددة
- `src/lib/maaroof/benchmark.server.ts` — تسجيل قياسات ومقارنة زمنية
- ربط `workflow.server.ts` الحالي كمنفّذ للرسوم البيانية بدل كتابة منفّذ ثانٍ

## الموجة 2 — RVE + Reality Lab

- `src/lib/maaroof/verification.server.ts` — واجهة `verify(result, context)` تمر بالمراحل: اكتشاف الأدلة ← تصنيف ← ترجيح ← تحقق متقاطع ← تحقق تاريخي ← تصنيف الواقع ← الامتثال الدستوري ← درجة ثقة + شرح. تعيد ما تعيده الطبقات الحالية دون تغيير سلوكها (لا استبدال لـ `trust.server.ts`).
- تفعيلها داخل `orchestrator.server.ts` في نفس النقطة التي يُصنَّف فيها الواقع اليوم — بدون مسار ثانٍ.
- جداول `lab_experiments` و `lab_runs`: فرضية، متغيرات، عينة، نتيجة، هل تكررت، أثرها على المعرفة/الثقة.
- `src/lib/maaroof/lab.server.ts` — تشغيل تجربة، إعادة الإنتاج، وإغلاق الحلقة على `knowledge_nodes` و `trust_profiles`.
- إعدادات: `execution_engine`, `verification_engine`, `reality_lab` في `settings.server.ts` — كلها **معطّلة افتراضياً** حتى يفعّلها المؤسس (نفس نمط `reality_engine`).

## الموجة 3 — HERMES EOS + التدقيق النهائي (Part 7)

- توسعة `hermes.server.ts`: ربط المهام التنفيذية بـ `executions`، مراقبة حيّة للتنفيذ، تقرير تنفيذي دوري، وقرارات المؤسس (موافقة/رفض/تعليق/استئناف/أرشفة) تُخزَّن كذاكرة دستورية في `hermes_founder_dna`.
- `src/lib/maaroof/audit.server.ts` — تدقيق معماري محلي (بدون نداءات نموذج): تغطية التنفيذ، درجات معمارية، مؤشر الجاهزية، تحليل الفجوات، خارطة طريق، وملخص تنفيذي.
- `Architecture Atlas` — بيان علاقات المكوّنات يُولَّد من سجل المحركات ويُعرض داخل `MaaroofIntelligenceCenter` (تبويب جديد داخل نفس اللوحة، لا صفحة جديدة).
- تصدير التقرير: JSON / Markdown / Word / PowerPoint عبر مسار التصدير الموجود في HERMES.
- توثيق: `docs/PART19-PARTS-2-7.md` يشرح لكل متطلّب حالته (منفَّذ / موجود مسبقاً / مدموج / محسّن / معلّق / يحتاج موافقة المؤسس) وسبب التطوير بدل الإنشاء.

## تفاصيل تقنية

- كل جدول جديد: `CREATE TABLE` ثم `GRANT` ثم `ENABLE RLS` ثم سياسات (المالك + `has_role(auth.uid(),'admin')` + `service_role`).
- كل منطق الحساب محلي/حسابي — صفر نداءات نموذج إضافية عدا محادثة HERMES القائمة.
- كل الملفات `*.functions.ts` تبقى أغلفة رفيعة (تصريحات server-fn فقط) والمنطق في `*.server.ts` استيراداً داخل الـ handler.
- كل النصوص الجديدة في الواجهة عبر قواميس `src/lib/i18n/{ar,en,ku}.ts` — لا نص مكتوب مباشرة.
- التوافق الخلفي: لا حذف ولا إعادة كتابة لأي دالة قائمة؛ الإضافات خلف مفاتيح إعدادات معطّلة افتراضياً.
