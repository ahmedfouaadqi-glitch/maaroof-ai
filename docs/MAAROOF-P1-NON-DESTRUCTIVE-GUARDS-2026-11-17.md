# MAAROOF Ai — P1 Non-Destructive Guards

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Scope:** P1 — preservation of workspace and tool-result history  
**Supabase boundary:** no live connection, query, schema, policy, or migration inspection was performed.

## Implemented in this branch

1. Added `src/lib/non-destructive-mode.ts` as the shared guard for destructive actions.
2. Added unit coverage in `src/lib/non-destructive-mode.test.ts` for:
   - `tool_result_delete`
   - `tool_history_clear`
   - `workspace_delete`
3. Removed automatic pruning of historical tool results after the 50-row threshold in `src/lib/tool-history.functions.ts`. The 50-row default list limit remains a presentation/retrieval limit; it no longer triggers deletion.
4. Changed the existing server actions for deleting one result and clearing a tool's history to reject the operation before any handler-level data access.
5. Changed the workspace deletion server action to reject the operation before any handler-level data access.
6. Removed the destructive controls from `ToolHistory`, `WorkspaceSpacesPanel`, and `WorkspaceSwitcher`, and removed report-template deletion from `ReportBuilder`, while preserving history viewing, workspace selection, creation, template saving/reuse, and export controls.
7. Removed the report-template delete control from `ReportBuilder`; saved templates remain available for reuse.
8. Added Arabic, English and Kurdish explanatory notices in the affected interfaces.

## Verification

- GitHub Actions run `44054533215` for head `137fabd06d8256176919184b8ca6e57b02730545`:
  - Dependency installation: PASS
  - Unit tests: PASS
  - Production build: pending at the time of this document.
- All 11 protected model/catalog files retain their baseline Git blob fingerprints.
- No Supabase connection or query was made.
- No database migration, deletion, archive write, or restore write was executed.

## Archive and restore design requirements — not yet implemented

Persistent archive/restore cannot be implemented safely without inspecting and validating the existing storage schema, foreign-key behavior, and ownership policies. The design constraints are therefore recorded without inventing a migration:

- Archive must be a reversible state transition, not a physical delete.
- A parent workspace archive must account for descendants and linked knowledge spaces as one coherent operation.
- Archive must preserve conversations, interviews, knowledge nodes, assets, evidence, tool history, reports and job events.
- Restore must validate the complete subtree and restore the prior active state without duplicating records.
- Archived workspaces must be excluded from active workspace selection while remaining available to the owner in an archive view.
- No data may be re-assigned to a different owner or workspace during archive/restore.
- Every archive/restore event must record actor, timestamp, target, and outcome.
- Any future schema change must be additive, reversible, tested against a confirmed non-production database, and must not use cascade deletion.

## Additional non-destructive sweep — 2026-11-19

- Schedule deletion now transitions the schedule to `cancelled`; the schedule row and history remain.
- Knowledge-space deletion now transitions the existing `status` field to `archived`; the same space can be restored through the existing `updateKnowledgeSpace(status: "active")` contract. Archived spaces are read-only in the UI.
- Physical knowledge-asset deletion is rejected by the server function with `knowledge_asset_delete_disabled_non_destructive_mode`; the UI no longer exposes the delete control.
- The in-workspace file manager no longer exposes storage/object or attachment-row deletion.
- Maaroof Memory no longer exposes individual or bulk delete controls. Existing automatic memory pruning remains disabled.
- Autonomous-agent targets are deactivated through the existing `active` state instead of deleting their rows; completed `agent_tasks` history no longer exposes a delete control.
- Added `knowledge_asset_delete` to the shared destructive-operation guard and its unit tests.
- Static review of all API route files classified remaining cleanup operations: reserved visibility-trial rollback and newly uploaded orphan-file cleanup are transactional cleanup; OAuth state cleanup and publishing-channel disconnect are credential/session lifecycle operations; admin plan/role/CMS deletion is administrative configuration/content, not workspace or tool-result history.

**No data rows, storage objects, archive state, or restore state were changed during this source-code work. No migration was created.**

## P1 status

**PARTIAL — reviewed user-facing destructive paths are blocked, hidden, or converted to reversible state transitions; full P1 acceptance is not claimed.**

Outstanding:
- Finish the repository-wide sweep of any remaining non-API client-side deletion paths.
- The protected `ai-engines.functions.ts` and `maaroof-models.functions.ts` modules were deliberately not opened or modified; their review remains excluded by the model/engine protection boundary.
- Implement and test coherent archive/restore for complete workspace subtrees; the existing knowledge-space status alone is not a workspace archive system.
- Verify persisted owner/workspace isolation and cascade behavior only if the Supabase boundary is explicitly reopened.
- UI-only removal of memory and attachment deletion controls is not a substitute for verified RLS enforcement.

## تنفيذ إضافي بعد مراجعة المسارات — 2026-11-17

- أزيل التقليم التلقائي من `maaroof_memory` عند تجاوز 1,000 سجل؛ إضافة ذاكرة جديدة لم تعد تحذف السجلات الأقدم.
- أُوقف الحذف الدائم للمحادثات في `/api/maaroof-chat` بإرجاع `409 non_destructive_mode`، وأزيلت أزرار الحذف من `Dardasha` و`MaaroofChat`.
- مسارا حذف نتيجة الأداة ومساحة العمل يظلان محميين بواسطة `blockDestructiveOperation`.
- حذف سجل `visibility_trial_attempts` الذي رُصد في المراجعة محصور في إلغاء حجز مؤقت بحالة `reserved` عند فشل بدء المحاولة؛ لا يحذف محاولة مكتملة أو تاريخ نتائج.
- أُبقيت عملية إزالة ملف مرفوع حديثاً عند فشل إنشاء سجل المرفق بوصفها معالجة لملف يتيم جديد، لا حذفاً لتاريخ المستخدم.

**الحالة: جزئية.** لم يثبت بعد خلو جميع المستودع من كل مسار حذف، كما لم تُنفذ أرشفة/استعادة دائمة؛ يتطلب ذلك عقد تخزين وسياسة صلاحيات غير متحققين ضمن قيد عدم الاتصال بـ Supabase.
