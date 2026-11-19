# MAAROOF Ai — P4 Tools, Skills and Operational Catalog Review

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Scope:** static review of tool catalog, option registry, skill catalog and external skill registry.  
**Protected engine catalog:** not opened or modified.

## Verified inventory

- `TOOL_CATALOG`: 24 unique tool keys.
- `TOOL_OPTIONS`: 17 option-bearing tool keys (after removing stale options for the centrally paused competitor monitor).
- Every `TOOL_OPTIONS` key resolves to a key in `TOOL_CATALOG` (also covered by the existing unit test).
- `MAAROOF_SKILLS`: 21 skills.
- Every tool referenced by a skill exists in `TOOL_CATALOG` (covered by the existing unit test).
- Existing skill tests assert all seven skill framework parts are populated.
- The skill catalog test asserts that the paused `competitor_monitor` tool is not bound to any skill.
- External skill registry: 70 package variants representing 69 unique names; the two Humanizer variants remain distinct.
- Existing external-skill tests assert every imported package remains `candidate`, `reference_only`, and `executionAllowed: false`.

## Findings and boundaries

1. `TOOL_OPTIONS` is a partial options registry, not a complete endpoint contract inventory. The 24 tool keys and 17 option keys are not expected to be identical; the seven catalog keys without an options entry require individual classification before treating them as gaps.
2. Existing tests verify registry membership and skill-to-tool references. They do not prove that every declared option matches the current request schema and validation behavior of its API route.
3. A route inventory contains 36 files under `src/routes/api/`; some are system/public/webhook routes and not direct tool endpoints. Route-to-tool mapping remains a separate task.
4. `competitor_monitor` is centrally paused (the route returns 503 before auth/provider/billing work) and is excluded from skills. Its stale planner options, including the unsupported `delete` action, were removed on 19 November. `KnownDiscovery` no longer calls the paused endpoint and retains only compare selection; `CompetitorMonitor` now renders a localized paused notice with no API calls.
5. External skill packages remain inactive and non-executable. No imported script or package was executed.
6. No live provider call, paid operation, model probe, or Supabase query was performed.

## Relevant source and tests

- `src/lib/tool-catalog.ts`
- `src/lib/tool-options.ts`
- `src/lib/tool-options.test.ts`
- `src/lib/maaroof/skill-catalog.ts`
- `src/lib/maaroof/skill-catalog.test.ts`
- `src/lib/maaroof/external-skill-registry.ts`
- `src/lib/maaroof/external-skill-registry.test.ts`

## P4 status

**PARTIAL — registry integrity and skill references verified.** A source-level route map is now recorded, and stale options for the paused competitor monitor were removed from `TOOL_OPTIONS`. Full field-by-field request-contract validation, external package license review, and operational engine dependency review remain outstanding. The current Library listing exposes a manifest and consolidated reference document, but not the original per-package ZIP archives; therefore archive-level license/attribution verification and source import are not being claimed. `TOOL_CATALOG`, `MAAROOF_SKILLS`, and the protected engine catalog were not changed.

## تنفيذ ومراجعة إضافية للمسارات — 2026-11-17

- واجهة `SkillToolsPanel` تعرض الأدوات التي لها مكوّن UI مباشر، وتعرض الأدوات الأخرى المرتبطة بالمهارة بوصفها تعمل ضمن المهام فقط؛ لا يجوز اعتبار غياب مكوّن مباشر دليلاً على فقدان الأداة من الكتالوج.
- `DirectToolsPanel` يضم مكوّنات الأدوات المباشرة، ويعرض `competitor_monitor` بحالة توقف معلنة دون إطلاق تنفيذ.
- `workspaceGuard` يثبت ملكية المساحة في سياق الطلب؛ و`getUserContext` يقرأ بيانات مساحة العمل من سجلها بدلاً من ملف الحساب عندما يكون سياق المساحة مثبتاً.
- عُزلت مفاتيح MCI وتلميحات التخطيط حسب الحساب/المساحة، وعُزلت إعادة استخدام نتائج Known وحفظ سجل تشغيلها حسب مساحة العمل. عند غياب دعم `workspace_id` في مخزن Known، يُرفض تشغيل المساحة قبل الخصم.
- تمت مراجعة عينة من المسارات المباشرة ومسارات المرفقات والتقارير والمهام؛ بعض المسارات تستخدم تحقق ملكية يدوياً بدلاً من `workspaceGuard`، وبعضها يعتمد سياق الطلب المشترك.

**ما لم يُحسم:** لم يكتمل بعد جدول موثق لكل مكوّن UI → endpoint → body contract → authorization → workspace persistence لكل الأدوات الـ24. لا تزال مراجعة كل route وجميع حقول `TOOL_OPTIONS` مطلوبة. لم تُنفذ اختبارات تشغيل فعلية أو اتصالات مزودين.

## تصنيف مفاتيح الكتالوج غير الموجودة في TOOL_OPTIONS

بعد إزالة خيارات الأداة الموقوفة، توجد سبعة مفاتيح بلا تعريف في `TOOL_OPTIONS`، ولا تعدّ تلقائياً أدوات مفقودة:
- `maaroof`: مدخل المنسق الرئيسي عبر `/api/maaroof`، وله عقد طلب مستقل.
- `translate`: وظائف ترجمة خادمية في `translate.functions.ts` و`translate-export.functions.ts`؛ لا يوجد مسار API مستقل أو مكوّن أداة مباشر.
- `agent.command` و`agent.run_targets` و`agent.visibility`: مفاتيح من مجموعة `agent`؛ وظائف الوكيل القديمة موجودة في `agent.functions.ts` و`agent.server.ts`، لكن الربط الدقيق لكل مفتاح مع دالة تشغيل لم يثبت من call-sites.
- `teach_space`: وظائف خادمية في `teaching.functions.ts` ومكوّن `KnowledgeSpaces`؛ ليس عقد API مباشر ضمن `/api/*`.
- `competitor_monitor`: أداة موجودة في الكتالوج لكنها موقوفة مركزياً؛ لا تُعرض لها خيارات تشغيل إلى أن يعاد تفعيلها بعد مراجعة مستقلة.

**الاستنتاج:** سلامة عضوية المفاتيح مثبتة، لكن المفاتيح السبعة تحتاج تصنيفاً تشغيلياً مستقلاً؛ لا يجوز تحويلها تلقائياً إلى endpoints أو خيارات تنفيذ.

## خريطة مكونات الواجهة إلى مسارات API — عينة مصدرية موثقة

| مكوّن الواجهة | مسارات API التي ظهرت صراحة في المصدر | ملاحظات |
|---|---|---|
| `Sandbox` | `/api/analyze`, `/api/geo-rewrite` | إعادة الصياغة جزء مضمّن من أداة التحليل |
| `PostSuggester` | `/api/suggest` | طلب مباشر |
| `CompetitorCompare` | `/api/compare` | طلب مباشر |
| `KnownDiscovery` | `/api/known`, `/api/competitor-monitor` | إنشاء مراقبة المنافسين مرتبط بمسار المراقبة الموقوف |
| `FeasibilityStudy` | `/api/feasibility` | يرسل `workspace_id` |
| `BizDev` | `/api/bizdev` | يرسل `workspace_id` |
| `BrandBoostAgent` | `/api/brand-boost`, `/api/brand-authority`, `/api/brand-boost-report-settings` | عدة مسارات ضمن تجربة واحدة |
| `AppliedRanking` | `/api/applied-ranking` | طلب مباشر |
| `VisibilityIntelligence` | `/api/site-discovery`, `/api/visibility-baseline` | سجل النتائج يقرأ من `brand_operations`؛ مسار تشغيل probe يحتاج تتبعاً إضافياً |
| `GeoStrategist` | `/api/geo-strategist` | مساحة العميل تفشل مغلقة عند غياب عقد التخزين المعزول |
| `WhatIfSimulator` | `/api/what-if` | baseline أصبح مقيداً بالمساحة |
| `SmartResearch` | `/api/research` | يستخدم سياق المستخدم/المساحة |
| `CompanyOutreach` | `/api/company-email` | يستخدم سياق المستخدم/المساحة |
| `SecurityScanCard` | `/api/security-scan` | يرسل `workspace_id` |
| `KeywordIntelligence` | `/api/keyword-upload`, `/api/dual-result` | رفع المرفقات والنتيجة المزدوجة |
| `CompetitorMonitor` | `/api/competitor-monitor` | المسار معلّق مركزياً |
| `ReportBuilder` | استعلامات Supabase مباشرة | بيانات المقاييس مقيّدة؛ القوالب وسجل الأدوات القديم مخفيان داخل مساحات العميل |

هذه خريطة endpoint strings التي جرى التحقق منها في المكونات المحددة، وليست بعد جدولاً كاملاً لكل callbacks أو server functions أو كل 24 مفتاح كتالوج.


## خريطة عقد الأدوات ذات الخيارات — 2026-11-19

| ToolKey | API / server contract | واجهة الاستخدام | نطاق/ملاحظة مصدرية |
|---|---|---|---|
| `analyze` | `POST /api/analyze` | `Sandbox` | Bearer auth + `workspaceGuard`; يرسل `workspace_id` |
| `suggest` | `POST /api/suggest` | `PostSuggester` | Bearer auth + `workspaceGuard` |
| `compare` | `POST /api/compare` | `CompetitorCompare` | Bearer auth + `workspaceGuard` |
| `known` | `POST /api/known` | `KnownDiscovery` | Bearer auth + `workspaceGuard`; يفشل مغلقاً عند تعذر نطاق التخزين |
| `feasibility` | `POST /api/feasibility` | `FeasibilityStudy` | Bearer auth + `workspaceGuard` |
| `bizdev` | `POST /api/bizdev` | `BizDev` | Bearer auth + `workspaceGuard` |
| `research` | `POST /api/research` | `SmartResearch` | Bearer auth + `workspaceGuard` |
| `visibility` | `POST /api/visibility` مع `site-discovery` و`visibility-baseline` كمسارات مساندة | `VisibilityIntelligence` | يتحقق يدوياً من ملكية مساحة العمل؛ لا يستخدم `workspaceGuard` |
| `brand_boost` | `POST /api/brand-boost` مع `brand-authority` و`brand-boost-report-settings` كمسارات مساندة | `BrandBoostAgent` | سياق المساحة يمر عبر المكوّن؛ المسارات المساندة لها عقود مستقلة |
| `company_email` | `POST /api/company-email` | `CompanyOutreach` | Bearer auth + `workspaceGuard` |
| `applied_ranking` | `POST /api/applied-ranking` | `AppliedRanking` | Bearer auth + `workspaceGuard` |
| `geo_strategist` | `POST /api/geo-strategist` | `GeoStrategist` | Bearer auth + `workspaceGuard`; لا يُشغّل مساحة عميل دون سياق صالح |
| `social_analysis` | `POST /api/social-analysis` | `VisibilityIntelligence` بوضع social | Bearer auth + `workspaceGuard` |
| `what_if` | `POST /api/what-if` | `WhatIfSimulator` | Bearer auth + `workspaceGuard`؛ baseline مقيّد بالنطاق |
| `brand_authority` | `POST /api/brand-authority` | جزء من `BrandBoostAgent` | مسار فرعي وليس بطاقة أداة مستقلة في `TOOL_UI` |
| `geo_rewrite` | `POST /api/geo-rewrite` | إجراء مضمّن في `Sandbox` | مسار فرعي وليس بطاقة أداة مستقلة في `TOOL_UI` |
| `keyword_intelligence` | `POST /api/keyword-upload` ثم `POST /api/dual-result` | `KeywordIntelligence` | رفع الملف والتحليل منفصلان؛ يمرر `workspace_id` |

`security_scan` و`report` مفاتيح واجهة إضافية في `TOOL_UI` وليسا `ToolKey` داخل `TOOL_CATALOG`. `competitor_monitor` موجود في الكتالوج لكنه موقوف، وخياراته لم تعد تُعرض على المخطط.

هذه خريطة source-level للمكونات والمسارات التي ظهرت في الملفات المحددة، وليست إثباتاً لتشغيل فعلي أو RLS أو عقد تخزين حي. ما زال يلزم تدقيق كل حقل من حقول `TOOL_OPTIONS` مقابل validators الفعلية، ومراجعة callback/authorization لكل مكوّن، ومراجعة تراخيص الحزم الخارجية قبل أي تفعيل.
