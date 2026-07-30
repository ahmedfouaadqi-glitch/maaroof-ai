# الموجة الثانية — الجزء 12 (حوكمة النماذج) + الجزء 13 (مركز القرار التنفيذي)

بناءً على الدستور: تطوير للموجود لا استبدال. الموجود فعلاً: `settings.server.ts` (planner_model / fallback_model / learning_model)، `capability.server.ts` (اختيار التنفيذ بالمقاييس)، `provider_rates` (أسعار المزودين)، `maaroof_runs.decision_log` (سجل قرارات مبدئي)، وتقدير تكلفة ثابت داخل `callGateway`. الناقص: سجل نماذج مركزي، اختيار نموذج لكل مهمة، مقترحات/بنشمارك/صحة النماذج، وسجل قرار كامل قابل للتدقيق والتصدير.

## 1) سجل النماذج (Model Registry)

جداول جديدة (مع GRANT + RLS: قراءة للمصادَقين، كتابة للأدمن فقط):
- `ai_models` — model_key, provider, version, capabilities jsonb (reasoning/coding/vision/audio/video/long_context)، speed, latency_ms, reliability, cost_in_usd_per_mtok, cost_out_usd_per_mtok, languages, supported_tools, supported_mcp, recommended_use_cases, limitations, status (active/candidate/deprecated), released_at, last_evaluated_at.
- `ai_model_proposals` — النموذج المقترح، السبب، المزايا/العيوب، أثر التكلفة/الجودة/السرعة، خطة الترحيل والاختبار والتراجع، status (pending/approved/rejected)، reviewed_by.
- `ai_model_benchmarks` — نفس المهمة على أكثر من نموذج: الدقة، الزمن، التوكنات، التكلفة، الملاحظات.
- `ai_model_health` — أخطاء/نجاح/زمن استجابة مجمّع لكل نموذج (يُغذّى من كل نداء).

يُزرع السجل بالنماذج المتاحة فعلاً في المنصة (Gemini 2.5 Pro/Flash/Flash-Lite، GPT‑5.x ...) بأسعارها الحقيقية بدل الأرقام المضمّنة في الكود.

## 2) محرك اختيار النموذج

ملف جديد `src/lib/maaroof/models.server.ts`:
- `selectModel({ phase, expert, capability, workspace, risk, budget })` → يعيد `{ model, fallback, reason, expected_cost }` بناءً على قدرات النموذج وتكلفته وسرعته وتفضيلات الـ workspace (`preferred_models`) والحدود المالية.
- `recordModelCall(...)` → يحدّث `ai_model_health` ويستخدم أسعار `ai_models` الحقيقية بدل التقدير الثابت.
- `proposeModelUpgrade()` → يولّد Proposal تلقائياً عند رخص أو تحسّن ملحوظ، ولا يُطبَّق شيء دون موافقة الإدارة.

تعديل `orchestrator.server.ts`: استبدال `const MODEL = settings.planner_model` بنداء `selectModel` لكل مرحلة (تخطيط / مجلس خبراء / تنفيذ / تأمل / إجابة نهائية)، مع الإبقاء على `planner_model` كافتراضي عند إطفاء المفتاح — سلوك مطابق حرفياً عندما `model_governance_enabled = false`.

## 3) مركز القرار التنفيذي (Part 13)

- جدول `decision_traces`: run_id, stage, goal_understanding, strategy, experts, capabilities, tools, models, mcp, cost, risk, time, future_impact, confidence, alternatives_rejected (مع الأسباب)، score.
- توسيع `decision_log` الحالي في `maaroof_runs` بدل استبداله: كل مرحلة من الـ20 في الـ pipeline تُسجَّل كسطر trace.
- `src/lib/maaroof/decisions.server.ts`: توليد وتقييم بدائل الخطة (خطتان-ثلاث مقارنة جودة/تكلفة/وقت) واختيار الأفضل مع تعليل، ثم حساب Decision Score.
- الأوركستريتور يبثّ حدث SSE `decision` لعرض التتبّع في واجهة `/maaroof` داخل بطاقة الثقة الموجودة (TrustPanel) بدل بطاقة جديدة.

## 4) واجهة الإدارة

داخل `MaaroofIntelligenceCenter` الموجود (لا صفحات جديدة منفصلة):
- لوحة **AI Model Center**: جدول النماذج، الحالة، التكلفة الحقيقية، الصحة، أزرار Benchmark، وقائمة المقترحات مع قبول/رفض.
- لوحة **Decision Center**: خط زمني للقرارات، شجرة القرار، النتيجة/الثقة/التكلفة/المخاطر، البدائل المرفوضة، بحث وتصفية، وتصدير CSV / JSON / Markdown / PDF (بالاعتماد على مسار التصدير الموجود) بالعربية والإنجليزية والكردية.

## 5) مفاتيح ووثائق

- مفاتيح في `maaroof_settings`: `model_governance_enabled`, `decision_trace_enabled`, `benchmark_enabled` — كلها مطفأة افتراضياً.
- تحديث `docs/MAAROOF-AUDIT.md` بمبرر التطوير فوق الموجود ومواضع الدمج.

## ملاحظات تقنية

- كل جدول جديد: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → سياسات (قراءة للمصادَقين على `ai_models` فقط؛ الباقي أدمن عبر `has_role`).
- التكاليف تُقرأ من `ai_models` + `provider_rates` لتظل شاشة المالية متسقة مع التكلفة الحقيقية.
- لا كسر للتوافق: عند إطفاء المفاتيح، مسار التشغيل الحالي كما هو حرفياً.
