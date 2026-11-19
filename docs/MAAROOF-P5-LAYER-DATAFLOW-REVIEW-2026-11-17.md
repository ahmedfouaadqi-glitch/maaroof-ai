# MAAROOF Ai — P5 Layer and Data-Flow Review

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Scope:** static source review and documentation of the current application boundaries.  
**Exclusions:** no Supabase connection/query/schema/RLS inspection, no Cloudflare, no paid probes, no protected engine-catalog reads.

## Current layer map

1. **Presentation and navigation**
   - Public routes and authenticated workspace route.
   - `WorkspaceSwitcher` selects the active client workspace.
   - `WorkspaceSpacesPanel` creates and displays hierarchical spaces.
   - `WorkspaceAccountPanel` edits workspace identity/onboarding data.
   - `ReportBuilder` assembles report sections from existing metrics, saved history and in-memory tool results.

2. **API and server functions**
   - 36 files currently exist under `src/routes/api/` (including public, webhook, system and tool endpoints).
   - TanStack server functions mediate workspace, history, task and other authenticated operations.
   - This count is a route inventory, not proof that every route has been reviewed or that authorization is correct.

3. **Tool and skill orchestration**
   - `TOOL_CATALOG` describes tool identity/capabilities.
   - `TOOL_OPTIONS` describes accepted request options for a subset of tools.
   - `MAAROOF_SKILLS` maps user-facing skills to existing tools.
   - External skill packages remain reference-only and non-executable.
   - The ten language engines and their council/probe modules remain protected and unchanged.

4. **Evidence, memory and decision support**
   - MCI foundation modules, evidence packing, visibility metrics, trust/decision/reality and knowledge layers.
   - Evidence-pack and visibility-metric semantic issues remain in the P0 risk register.
   - No paid/live model execution was used for this review.

5. **Jobs and execution**
   - Existing job/event model and SSE/resume paths are preserved.
   - This review did not inspect live database records or prove persisted job ownership/retention.

6. **Export and report domain**
   - Existing `exports.ts` and `ExportButtons` remain the export surface.
   - In-memory export bus now scopes captured results by active workspace.
   - New pure report-domain modules define the versioned report snapshot, executive/technical projections, branding settings, approval lifecycle, share grants and reports-center selectors.

7. **Persistence and authorization**
   - Persisted owner/workspace isolation, RLS, cascades, report templates, report drafts, job records, and access logs are outside the current permitted inspection scope.
   - UI workspace selection is not an authorization boundary. Server-side authorization remains required.

## Confirmed data-flow for new report foundations

`existing tool outputs → evidence-linked AuditReportSnapshot → executive/technical projections → existing ExportPayload → existing export format handlers`

The new report foundations perform no database or network I/O. They are not yet connected to persistent storage, approval APIs, share routes or a report-center UI.

## P5 status

**PARTIAL — presentation, tool, evidence, execution and export boundaries mapped at source level.** Complete auth/RLS/persistence tracing, all API contract mapping, and end-to-end data-flow verification remain outstanding.

## تحديث مسارات البيانات — 2026-11-17

- سياق الطلب يحمل معرف المساحة بعد التحقق، وتستخدمه أدوات السياق المشتركة للحصول على هوية العميل بدلاً من الرجوع إلى ملف الحساب.
- مفاتيح MCI وتلميحات التخطيط ونتائج Known المعاد استخدامها أصبحت مرتبطة بنطاق المساحة؛ حفظ Known في مساحة عميل يتطلب دعم `workspace_id`.
- استرجاع المعرفة والذاكرة يفصل بين نطاق مساحة العمل ونطاق الحساب الأساسي، مع إبقاء المعرفة العامة `platform` مشتركة عمداً.
- سجل المهام والأحداث أصبح يدعم صفحات إضافية؛ الواجهة تمنع خلط صفحات قديمة عند تبديل المساحة، وتصدير المهمة يواصل قراءة الأحداث حتى اكتمال جميع الصفحات.
- تم إيقاف التقليم التلقائي للذاكرة وسحب مسار الحذف الدائم للمحادثات.

**الحالة لا تزال PARTIAL.** هذه تغييرات ومراجعات مصدرية فقط. لم يتم إثبات ملكية البيانات في قاعدة البيانات، أو سلامة RLS، أو عمل الاستعادة الدائمة، أو تدفق تقارير متصل بمخزن دائم.


## Additional execution/data-flow trace — 2026-11-19

- Task-history list requests carry an explicit workspace scope and use bounded page windows.
- Job-ID reads and cancellation require explicit workspace scope; the main account is represented by an explicit empty/null scope, not by omission.
- Job polling, replay, export and resume now use the workspace recorded on the job. Resume reads event pages through the scoped API rather than issuing direct client queries to `maaroof_job_events`.
- Event pagination uses ascending sequence numbers, an `event_limit + 1` look-ahead row, and a monotonic `next_after` cursor; the client rejects a non-advancing cursor.
- P1 preservation controls now retain schedule, knowledge-space, attachment and memory records through cancellation/archive or removal of destructive UI controls. No data write was executed during this review.
- P4 now distinguishes the 17 option-bearing tool contracts from the seven catalog entries that intentionally have no direct options schema; the centrally paused competitor monitor is not advertised to the planner.

**P5 remains PARTIAL.** The source-level flow is clearer and job-history access is explicitly scoped, but persisted ownership, RLS, report-draft persistence, approval/share access logs and end-to-end data flow remain unverified. No Supabase, live provider, Cloudflare or paid execution was used.
