
# الجزء 2 — Cognitive Architecture (تطوير لا استبدال)

يُطبَّق دستور المشروع: كل بند من الجزء 2 يُدمَج داخل ما هو قائم (workspaces, maaroof_memory, maaroof_runs, orchestrator, schedules)، بدون جداول/مسارات/مكوّنات جديدة إلا حيث لا يوجد مكافئ.

## مصفوفة الامتثال (Part 2)

| مكوّن الدستور | القائم | القرار |
|---|---|---|
| Future-Driven thinking | `plan()` مفرد | **تطوير**: إضافة مرحلة `envision()` قبل `plan` تُنتج future_goal + backward_chain — تُخزَّن في `decision_log` |
| Executive Thinking (Understand→…→Evolve) | Plan-Council-Act-Reflect | **تطوير**: إعادة تسمية داخلية للمراحل ودمج Predict/Simulate/Evaluate ضمن `council` الحالي، وObserve/Optimize/Learn ضمن `reflect` — بلا كسر التسلسل |
| Workspace Intelligence (Profile/Policies/Goals/Graph/Timeline…) | `workspaces` (name, kind, brand_url, brand_summary, keywords, language, country, city) | **تطوير**: إضافة أعمدة jsonb: `profile`, `policies`, `goals`, `success_metrics`, `preferred_models`, `preferred_experts`, `preferred_mcp`, `risk_level`, `budget`. Timeline/Decisions/Costs تُشتَق من `maaroof_runs` مُفلترة بـ`workspace_id` — لا جدول جديد |
| Workspace Memory / Brand Memory | `maaroof_memory` (user-scoped) | **تطوير**: إضافة `workspace_id uuid` + فهرس؛ الاستدعاء يرجّح الذاكرة داخل نفس الـworkspace أولاً |
| Memory Intelligence (Confidence/Freshness/Reliability/Source/UsageCount/DecisionImpact/LearningScore) | `importance`, `last_accessed_at` | **تطوير**: إضافة أعمدة `confidence numeric`, `freshness_at timestamptz`, `reliability numeric`, `source text`, `usage_count int`, `decision_impact numeric`, `learning_score numeric`. `recall` يُدمج هذه في ترجيح النتائج |
| Memory Layers (working/short/long/semantic/project/workspace/brand/decision/capability/agent/subagent/platform) | `MemoryKind` enum: fact/preference/task_result/summary/knowledge/decision | **تطوير**: توسيع الـenum بالطبقات الجديدة — الأنواع القديمة تبقى مقبولة |
| Knowledge Refresh (Firecrawl/Search/CompetitorScan → versioning) | `firecrawl.ts` + `schedules` + `competitor_watch` قائم | **تطوير**: schedule template جاهز اسمه `knowledge_refresh` يستدعي الأدوات القائمة ويحفظ الناتج كـ`memory kind=knowledge` مع `links.previous_version` (Versioning عبر السلسلة، بلا حذف) |
| Knowledge Graph | `maaroof_memory.links jsonb` محجوز أصلاً | **تطوير**: helpers جديدة في `memory.server.ts` تبني/تقرأ الحواف من نفس العمود — لا جدول |
| Decision DNA | `maaroof_runs.decision_log` موجود | **تطوير**: توسيع شكل عنصر السجل ليشمل: rejected_alternatives, tool_choice_reason, model_choice_reason, agent_choice_reason, replan_reason |
| Learning DNA | reflect ينتج ملخص فقط | **تطوير**: `reflect()` يكتب سجل `memory kind=learning` (what_worked/what_failed/what_to_repeat/what_to_avoid) على مستوى workspace |
| Platform Intelligence (aggregate, no PII) | لا يوجد | **جديد مبرَّر**: view/materialized `platform_intelligence_v` فقط (تجميع بدون user_id) — لا جدول خام. لوحة الإدارة تعرضها في تبويب Cognitive Insights القائم |

## التنفيذ (مراحل صغيرة قابلة للتحقق)

### Phase 2A — Workspace Intelligence
- Migration واحدة: `ALTER workspaces ADD profile jsonb, policies jsonb, goals jsonb, success_metrics jsonb, preferred_models jsonb, preferred_experts jsonb, preferred_mcp jsonb, risk_level text, budget jsonb`.
- توسيع `workspaces.functions.ts` (نفس الملف): حقول اختيارية في update/create + قراءة كاملة.
- تبويب "Brand Profile" داخل `WorkspaceSwitcher.tsx` القائم (بدون route جديد) لتحرير الحقول.
- Orchestrator يقرأ الـprofile ويُمرّره ضمن `RunContext` كـ`workspaceProfile` — تُستخدَم في `plan/council` تلقائياً.

### Phase 2B — Living Memory Evolution
- Migration: `ALTER maaroof_memory ADD workspace_id uuid, confidence numeric, freshness_at timestamptz, reliability numeric, source text, usage_count int DEFAULT 0, decision_impact numeric, learning_score numeric` + فهرس `(workspace_id, kind, importance)`.
- توسيع `MemoryKind` في `memory.server.ts` (backward compatible).
- `recall()`: ترجيح مركّب = `importance*0.35 + freshness*0.2 + reliability*0.15 + confidence*0.15 + decision_impact*0.1 + learning*0.05`، مع أولوية لنفس `workspace_id` ثم capability.
- `remember()`: يقبل الحقول الجديدة بقيم افتراضية معقولة، ويزيد `usage_count` عند كل recall.
- Knowledge Graph helpers: `linkMemories(aId, bId, relation)` تُخزّن الحواف في `links[]`.

### Phase 2C — Future-Driven & Executive Thinking
- في `orchestrator.server.ts` (نفس الملف): مرحلة `envision(goal, workspaceProfile) → { future_goal, backward_chain[] }` قبل `plan()`. الناتج يُحقن في برومبت `plan` القائم.
- `council()` يوسَّع داخلياً: Predict + Simulate + Evaluate تُطلَب من كل خبير في نفس النداء (بدون زيادة نداءات LLM).
- `reflect()` يوسَّع لإخراج Learning DNA وحفظه كذاكرة `kind=learning` مع `learning_score`.
- kill-switch جديد في `maaroof_settings.council.envision_enabled`.

### Phase 2D — Decision & Learning DNA
- شكل موحّد لعناصر `decision_log`: `{ stage, decision, rationale, rejected_alternatives, tool_choice_reason, model_choice_reason, agent_choice_reason, replan_reason, confidence }`.
- `MaaroofAdminTab` القائم يعرض هذه الحقول (تعديل عرض فقط، لا مكوّن جديد).

### Phase 2E — Knowledge Refresh (schedule template)
- بدل جدول جديد: نضيف `template` معروف اسمه `knowledge_refresh` داخل `SchedulesPanel.tsx` القائم. يستخدم Firecrawl + `research` + `competitor_monitor` القائمة، ويكتب `memory kind=knowledge` مع `links.previous_version_id` (Versioning عبر السلسلة).

### Phase 2F — Platform Intelligence
- Migration: `CREATE VIEW platform_intelligence_v AS SELECT` تجميع (best_plans, best_tool_orderings, avg_cost, avg_quality) من `maaroof_runs + token_ledger` بدون `user_id`.
- عرضها في تبويب `CognitiveInsightsTab.tsx` القائم (لا تبويب جديد).

## التحقق بعد التنفيذ
- backward compatibility: الجولات القديمة (بلا workspace_id) تعمل كما هي.
- kill-switches: `council.enabled=false` و`council.envision_enabled=false` تُرجع للسلوك السابق حرفياً.
- توثيق: قسم "Part 2 Compliance" في `docs/MAAROOF-AUDIT.md` بعد كل Phase.

## خارج النطاق (ينتظر الجزء 3)
Agent Factory، Dynamic Sub-Agents، Hybrid MCP، Cost Intelligence، Admin Intelligence.
