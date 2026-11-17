# MAAROOF Ai — P3 Workspace Scope Review

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Scope:** P3 — workspace selection and in-memory export result isolation  
**Database boundary:** no Supabase connection, query, schema, policy, or migration inspection was performed.

## Implemented

1. `CapturedResult` now records its `workspaceId`.
2. The export bus key is composed from workspace identity and tool key, so the same tool can retain distinct in-memory results in separate workspaces.
3. `listCapturedResults` and `useCapturedResults` return only the requested workspace scope. The null scope represents the main account.
4. `useActiveWorkspaceId` reads the existing `maaroof.active_workspace_id` selection in the browser and listens for the existing `maaroof:workspace-changed` event.
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
