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
6. Removed the destructive controls from `ToolHistory` and `WorkspaceSpacesPanel`, while preserving history viewing and export controls.
7. Added Arabic, English and Kurdish explanatory notices in the affected interfaces.

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

## P1 status

**PARTIAL — destructive controls addressed in the reviewed paths; full P1 acceptance is not claimed.**

Outstanding:
- Complete search of every destructive path in the repository.
- Persistent archive/restore implementation and tests.
- Verification of persisted owner/workspace isolation and cascade behavior is explicitly excluded by the current instruction not to inspect Supabase.
- Production build result for the latest commit was pending at document creation.
