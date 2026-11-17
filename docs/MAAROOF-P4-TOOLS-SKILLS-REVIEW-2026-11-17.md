# MAAROOF Ai — P4 Tools, Skills and Operational Catalog Review

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Scope:** static review of tool catalog, option registry, skill catalog and external skill registry.  
**Protected engine catalog:** not opened or modified.

## Verified inventory

- `TOOL_CATALOG`: 24 unique tool keys.
- `TOOL_OPTIONS`: 18 option-bearing tool keys.
- Every `TOOL_OPTIONS` key resolves to a key in `TOOL_CATALOG` (also covered by the existing unit test).
- `MAAROOF_SKILLS`: 21 skills.
- Every tool referenced by a skill exists in `TOOL_CATALOG` (covered by the existing unit test).
- Existing skill tests assert all seven skill framework parts are populated.
- The skill catalog test asserts that the paused `competitor_monitor` tool is not bound to any skill.
- External skill registry: 70 package variants representing 69 unique names; the two Humanizer variants remain distinct.
- Existing external-skill tests assert every imported package remains `candidate`, `reference_only`, and `executionAllowed: false`.

## Findings and boundaries

1. `TOOL_OPTIONS` is a partial options registry, not a complete endpoint contract inventory. The 24 tool keys and 18 option keys are not expected to be identical; the six catalog keys without an options entry require individual classification before treating them as gaps.
2. Existing tests verify registry membership and skill-to-tool references. They do not prove that every declared option matches the current request schema and validation behavior of its API route.
3. A route inventory contains 36 files under `src/routes/api/`; some are system/public/webhook routes and not direct tool endpoints. Route-to-tool mapping remains a separate task.
4. `competitor_monitor` still declares an action enum including `delete`; it is excluded from skills by the existing test, but the endpoint itself remains a direct route and needs separate lifecycle/authorization review.
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

**PARTIAL — registry integrity and skill references verified.** Full endpoint request-contract mapping, external package license review, and operational engine dependency review remain to be completed. No catalog was changed.

## تنفيذ ومراجعة إضافية للمسارات — 2026-11-17

- واجهة `SkillToolsPanel` تعرض الأدوات التي لها مكوّن UI مباشر، وتعرض الأدوات الأخرى المرتبطة بالمهارة بوصفها تعمل ضمن المهام فقط؛ لا يجوز اعتبار غياب مكوّن مباشر دليلاً على فقدان الأداة من الكتالوج.
- `DirectToolsPanel` يضم مكوّنات الأدوات المباشرة، ويعرض `competitor_monitor` بحالة توقف معلنة دون إطلاق تنفيذ.
- `workspaceGuard` يثبت ملكية المساحة في سياق الطلب؛ و`getUserContext` يقرأ بيانات مساحة العمل من سجلها بدلاً من ملف الحساب عندما يكون سياق المساحة مثبتاً.
- عُزلت مفاتيح MCI وتلميحات التخطيط حسب الحساب/المساحة، وعُزلت إعادة استخدام نتائج Known وحفظ سجل تشغيلها حسب مساحة العمل. عند غياب دعم `workspace_id` في مخزن Known، يُرفض تشغيل المساحة قبل الخصم.
- تمت مراجعة عينة من المسارات المباشرة ومسارات المرفقات والتقارير والمهام؛ بعض المسارات تستخدم تحقق ملكية يدوياً بدلاً من `workspaceGuard`، وبعضها يعتمد سياق الطلب المشترك.

**ما لم يُحسم:** لم يكتمل بعد جدول موثق لكل مكوّن UI → endpoint → body contract → authorization → workspace persistence لكل الأدوات الـ24. لا تزال مراجعة كل route وجميع حقول `TOOL_OPTIONS` مطلوبة. لم تُنفذ اختبارات تشغيل فعلية أو اتصالات مزودين.

## تصنيف مفاتيح الكتالوج غير الموجودة في TOOL_OPTIONS

المقارنة المصدرية أظهرت ستة مفاتيح بلا تعريف في `TOOL_OPTIONS`، ولا تعدّ تلقائياً أدوات مفقودة:
- `maaroof`: مدخل المنسق الرئيسي، وله عقد API مستقل.
- `translate`: أداة من مجموعة `tools`، ويحتاج عقد ترجمة مستقلاً؛ لم يُعثر على مفتاح options له في السجل.
- `agent.command` و`agent.run_targets` و`agent.visibility` و`teach_space`: مصنفة `group: agent`، وليست أدوات مباشرة ذات نموذج options مماثل للأدوات الثماني عشرة.

**الاستنتاج:** سلامة عضوية المفاتيح مثبتة، لكن تصنيف العقود الستة لا يغني عن تتبع مسارات استدعائها الفعلية؛ يبقى هذا الجزء من P4 جزئياً.
