# MAAROOF Ai — P3 Workspace Scope Review

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Scope:** P3 — workspace selection and in-memory export result isolation  
**Database boundary:** no Supabase connection, query, schema, policy, or migration inspection was performed.

## Implemented

1. `CapturedResult` now records its `workspaceId`.
2. The export bus key is composed from workspace identity and tool key, so the same tool can retain distinct in-memory results in separate workspaces.
3. `listCapturedResults` and `useCapturedResults` return only the requested workspace scope. The null scope represents the main account.
4. `useActiveWorkspaceId` reads the existing `maaroof.active_workspace_id` selection in the browser and listens for the existing `maaroof:workspace-changed` event. Capture waits until this scope is resolved, preventing the first render from accidentally registering a client result in the main-account scope.
5. `ToolResultExport` captures results under the active workspace.
6. `ReportBuilder` filters its in-memory captured results to the active workspace.
7. Added `src/lib/export-bus.test.ts` covering main-vs-client separation, client-vs-client separation, and stable keys.

## Limits

- This is in-memory result isolation only. It does not establish database row isolation or persisted ownership.
- `report_drafts` persistence has not been changed to include a workspace identifier because the existing storage schema and ownership policies are outside the permitted inspection scope.
- `ReportBuilder` database metrics and saved templates remain backed by existing Supabase queries; their persisted workspace scoping is not verified or changed.
- Existing fixed history/metric retrieval limits remain; full pagination requires a separately reviewed persistence contract.
- The workspace selector's browser value is a UI context signal, not an authorization boundary. Server-side authorization remains authoritative and has not been independently validated here.

## Verification

- Unit test and production-build CI passed for commit `eb3076f6aa69b40f3289bd79437c2e4ccada81be`, which includes the export-bus scoping code and tests.
- The latest subsequent commits add only non-destructive UI/documentation refinements; their CI runs are tracked separately.
- The 11 protected model/catalog files remain unchanged by metadata comparison.

## P3 status

**PARTIAL — in-memory export-bus isolation implemented and tested.** Persisted workspace scoping, history pagination, report-template isolation, and RLS verification remain unverified because the storage layer is excluded.

## تنفيذ إضافي — 2026-11-17

- عُزلت مفاتيح MCI ونتائج التخطيط حسب الحساب/مساحة العمل؛ لم تعد تلميحات التخطيط تجمع مخابئ مساحات المستخدم المختلفة.
- قُيد استرجاع معرفة الرسم البياني إلى `platform` أو مساحة العمل المطابقة فقط، وفُصل نطاق الحساب الأساسي ذي `workspace_id = NULL`.
- أضيف تحقق صريح من صحة إحداثيات ملكية عقد المعرفة؛ عقد مساحة العمل تملكها المساحة (`user_id = NULL`) وعقد الحساب الأساسي تملكها هوية المستخدم.
- قُيدت إعادة استخدام نتائج أداة Known إلى `workspace_id` المطابق، وأضيفت كتابة `workspace_id` إلى سجل التشغيل عند توفر نطاق مساحة.
- قبل تشغيل Known في مساحة عميل، يتحقق المسار من قابلية قراءة عمود `workspace_id`؛ إذا لم يتوفر يرفض المسار قبل الخصم بدلاً من توسيع النطاق.
- أضيفت صفحات محددة لسجل المهام والأحداث؛ واجهة سجل المهام تستطيع تحميل صفحات أقدم، وتصدير المهمة يجمع جميع صفحات أحداثها.
- أضيفت حماية من إلحاق صفحة قديمة بمساحة أخرى عند تبديل المساحة أثناء التحميل.
- أداة GEO Strategist ترفض تشغيل مساحة العميل عندما لا يتوفر عقد تخزين معزول مثبت.

**الحالة: جزئية.** هذه مراجعة وتغييرات مصدرية واختبارات وحدات؛ لا تثبت عزل قاعدة البيانات أو RLS، ولا تغطي بعد كل استعلام في كل أداة. أي مسار يعتمد على عمود/سياسة غير متحققين يبقى غير مثبت حتى مراجعة قاعدة البيانات المصرح بها.

- عُدّل `ReportBuilder` ليقيد بيانات المقاييس والقوالب بهوية المستخدم والمساحة الحالية، مع عدم تحميل `report_drafts` القديمة ذات النطاق الحسابي داخل مساحة العميل.
- أُضيف انتظار حسم المساحة قبل عرض أي بيانات أو حفظ قالب، وإسقاط نتائج التحميل المتأخرة بعد تبديل المساحة.
- أُخفي سجل الأدوات القديم غير المثبت بنطاق مساحة عند فتح مساحة عميل؛ يظل متاحاً في نطاق الحساب الأساسي فقط.

**تنبيه:** يعتمد ظهور مقاييس/قوالب العميل على وجود `workspace_id` في جداولها. لم يتم فحص المخطط أو اختبار الاستعلامات على Supabase؛ لذلك إذا لم يكن العمود موجوداً فالمسار يفشل مغلقاً ولا يعرض بيانات الحساب كبديل.

- في `ReportBuilder` لا تُعرض سجلات `report_drafts` القديمة أو قوالب الحساب داخل مساحة العميل؛ تُخفى القوالب إلى أن يتوفر حقل نطاق مساحة مثبت في عقد التخزين. مقاييس التقرير تُطلب بهوية المستخدم ونطاق المساحة، وتُمسح البيانات السابقة قبل إعادة التحميل، وتُهمل الاستجابات المتأخرة بعد تبديل المساحة.
- مكوّن `ToolHistory` يخفي سجل الحساب الأساسي عند فتح مساحة عميل، بدلاً من عرض تاريخ غير مثبت النطاق.

هذا سلوك fail-closed مؤقت، وليس بديلاً عن استكمال التخزين الدائم متعدد المساحات.
