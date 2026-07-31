# Part 19 — الأجزاء 2 إلى 7: تطوير لا إنشاء

## لماذا التطوير بدل الإنشاء

تقييم الموجود قبل الكتابة أظهر أن كل مفاهيم الأجزاء 2–7 لها نظائر عاملة:

| المطلوب | الموجود قبل هذا الجزء | القرار المنفَّذ |
|---|---|---|
| محرك التنفيذ الواقعي (19.2) | `workflow.server.ts` (رسم بياني)، `capability.server.ts`، `models.server.ts`، `agent_tasks`، `hermes_tasks`، `maaroof_schedules` | طبقة تنفيذ واحدة تُرسل عبرها، ولا تُعيد تنفيذها |
| محرك التحقق (19.3) | `trust.server.ts` (13 مرحلة)، `reality.server.ts`، `laws.server.ts`، `decisions.server.ts` | واجهة تحقق واحدة تستدعي الطبقات نفسها بترتيب دستوري |
| محرك الأدلة (19.4) | جدول `evidence_items` بحقول مختصرة | توسعة الجدول نفسه بالتصنيف والوزن والصلاحية |
| المعايير (19.4) | `ai_model_benchmarks`، `expert_snapshots`، `capability_scores_v` | معيار عام لأي موضوع مقابل خط أساس عبر الزمن |
| مختبر الواقع (19.5) | لا يوجد | الإضافة الجديدة الوحيدة، وتعمل فوق المحركات القائمة |
| هيرمس EOS (19.6) | `hermes.server.ts` (مرصد، اقتراحات، مهام، DNA) | توسعة داخل الملف نفسه: إشراف على التنفيذ وقرارات المؤسس |
| التدقيق النهائي (19.7) | `laws.server.ts`، `system-health.functions.ts`، مركز الذكاء | مُدقِّق معماري يحسب الجاهزية من المحركات الحيّة لا من قائمة يدوية |

إنشاء محركات موازية كان سيُكرّر البيانات ويكسر التوافق الخلفي، لذلك كل جزء نُفِّذ كطبقة تنسيق تقرأ وتكتب في الجداول القائمة.

## المكوّنات المضافة

### قاعدة البيانات
- `executions` · `execution_tasks` · `execution_events` — سجل التنفيذ والمهام والمراقبة الزمنية
- توسعة `evidence_items`: `title, category, evidence_type, source_reliability, collection_method, workspace_id, expert_key, execution_id, language, expires_at, freshness, business_value, verification_history`
- `benchmarks` · `benchmark_results` — خطوط الأساس والقياسات
- `lab_experiments` · `lab_runs` — الفرضيات وتكرارها

جميع الجداول بـ GRANT ثم RLS ثم سياسات: المالك + `has_role(auth.uid(),'admin')` + `service_role`.

### الكود
- `src/lib/maaroof/execution.server.ts` — REE: goal → plan → resource_map → approval → run → measure → evidence → verify → learn → report. بدون مُنفِّذ حقيقي تبقى المهام «محاكاة» ولا يدّعي المحرك تنفيذاً لم يحدث.
- `src/lib/maaroof/evidence.server.ts` — تصنيف تسعة أنواع أدلة، وزن مركّب، تحلّل الصلاحية حسب الفئة، تحقق متقاطع (`crossValidate`).
- `src/lib/maaroof/benchmark.server.ts` — خطوط أساس، مقارنة اتجاهية، نسبة النجاح.
- `src/lib/maaroof/verification.server.ts` — RVE: عشر مراحل تُنهي بحكم واحد قابل للشرح.
- `src/lib/maaroof/lab.server.ts` — تجربة، تكرار، انحراف، إغلاق الحلقة على المعرفة والثقة.
- `src/lib/maaroof/audit.server.ts` — أطلس معماري لعشرين محركاً، مؤشر جاهزية بخمسة أبعاد، تحليل فجوات، خارطة طريق مشتقة، وتصدير Markdown.
- `src/lib/maaroof/hermes.server.ts` — أُضيفت طبقة EOS: `eosExecutionWatch` · `eosDecideExecution` · `eosExecutiveBrief`.
- `src/lib/maaroof-execution.functions.ts` — غلاف رفيع لدوال الخادم (كل المنطق داخل الـ handler).
- `src/components/admin/RealityLab.tsx` — خمسة تبويبات داخل مركز الواقع نفسه: التنفيذ · الأدلة · المعايير · التجارب · التدقيق المعماري.

## الإعدادات (معطّلة افتراضياً)

`maaroof_settings`:
- `execution_engine`: `enabled=false`, `default_mode=simulation`, `require_approval=true`, `max_tasks=8`, `max_cost_usd=5`
- `verification_engine`: `enabled=false`, `min_independent_sources=2`, `min_score=60`, `decay_evidence=true`
- `reality_lab`: `enabled=false`, `default_sample_target=3`, `match_tolerance=0.15`, `close_loop=true`

الإيقاف يعيد السلوك السابق فوراً؛ لا حذف ولا إعادة كتابة لأي دالة قائمة.

## الضمانات الدستورية

- صفر نداءات نموذج إضافية: كل التصنيف والقياس والتدقيق حساب محلي.
- لا تنفيذ إنتاجي بلا اعتماد المؤسس (`approval_required`).
- لا ادعاء بلا دليل: كل عملية تنفيذ تُنتج عناصر أدلة، وتُصنَّف حالتها الواقعية، وتُغلق حلقتها على المعرفة والثقة.
- كل نصوص الواجهة عبر قواميس `ar/en/ku`.
