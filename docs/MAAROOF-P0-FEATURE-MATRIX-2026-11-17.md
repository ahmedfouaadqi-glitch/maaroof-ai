# MAAROOF Ai — P0 Feature Matrix
**Date:** 2026-11-17  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Status:** PARTIAL — evidence-based; not a feature-completion certification.

| Feature / capability | Existing evidence reviewed | Current evidence status | Gap / acceptance work |
|---|---|---|---|
| Ten language engines | Protected catalog paths and CI baseline metadata only | Protected / not semantically inspected | Preserve exact catalog and verify fingerprints; no changes allowed |
| Tool catalog | Historical review reports and selected docs | Partial | Reconcile 24 catalog entries with executable routes and request schemas without opening protected engine code |
| Skill catalog | Selected skill review report; selected pure skill tests listed in tree | Partial | Map each skill to real executable tool and permission policy |
| MCI foundation | Pure MCI modules, index and tests | Static implementation verified; runtime wiring unknown | Reconcile historical audit claims and permitted call sites; add boundary tests later |
| Account kinds | `account-kinds.ts` and unit tests | Pure rules verified | Verify onboarding integration without crossing excluded services |
| Workspace hierarchy | `space-structure.ts` | Pure rules verified | Verify server enforcement and existing data behavior; persistence excluded |
| Workspace scoping | `workspace-scope.ts` and unit tests | Pure predicate verified | Full per-table/per-function isolation unverified due Supabase exclusion |
| Workspace ownership guard | Test file with mocked query builder | Mock-level evidence only | Real authorization and RLS remain excluded/unverified |
| Workspace creation/interview UI | `WorkspaceSpacesPanel.tsx` import/control review | UI presence observed | Server behavior, billing, persistence and authorization excluded |
| Workspace deletion | UI confirmation and server-function call observed | Destructive surface confirmed; effects unknown | No P1 deletion behavior until archive/restore and cascade contract is safely verified |
| Tool history | `ToolHistory.tsx` exposes per-item delete and clear-all | UI presence verified; retention unknown | Inspect permitted service contract only if scope changes; preserve history |
| Background jobs | Historical docs and source inventory | Existing architecture referenced; current full flow not verified | Map jobs/events/resume without excluded persistence |
| Approval queue | `ApprovalQueue.tsx` calls publish approval functions | UI flow observed | Keep publish approvals separate from report approvals; authorization unverified |
| Visibility metrics | Pure metric helpers and tests | Static logic and ordinary fixtures reviewed | Add adversarial engine/status/mention fixtures |
| Social visibility metrics | Pure helper and tests | Static logic partially reviewed | Confirm null denominators and evidence requirements |
| Export formats | `exports.ts`, export controls and selected tests | Format implementations and unit fixtures observed | Browser/round-trip/RTL/large payload validation remains |
| Machine-readable pack | `machine-pack.ts`, export tests and docs | Existing output paths documented | Validate full payload completeness and client-safe content |
| Session export bus | `export-bus.ts` | Module-global tool-key map confirmed | Workspace/owner isolation is absent from current contract; test workspace switching |
| Report Builder | Component imports inspected; Supabase import observed | Existing UI identified; internals excluded | Query scoping, pagination, templates and report source completeness unverified |
| Executive Report Engine | Existing ExportButtons/ReportBuilder reusable components identified | New target capability not demonstrated | P9 deliverables remain unimplemented/unverified |
| Technical Report Engine | Existing evidence/metric/export utilities identified | New target capability not demonstrated | P10 deliverables remain unimplemented/unverified |
| White Label Manager | Export identity utility exists; report UI partial | Partial existing primitives | Workspace-scoped identity editor, preview and three branding modes not verified |
| Custom report approval | Existing publish ApprovalQueue only | Not demonstrated as report workflow | P11 remains unimplemented/unverified |
| Secure sharing | No approved evidence in reviewed files | Unknown | P12 remains unimplemented/unverified |
| Reports & Deliverables Center | ReportBuilder exists | Partial related UI | Central workspace-scoped deliverables center not demonstrated |
| PWA metadata | `manifest.webmanifest` reviewed | Static config observed | Asset dimensions and browser install behavior need verification |
| CI | Workflow file and one baseline Actions run | Baseline CI verified | Must rerun after any code changes; lint/typecheck not explicit in reviewed workflow |
| Secret handling | Root listing and `.gitignore` metadata | Potential exposure indicator | Safe secret scan/rotation verification required; do not read/display values |

## Status vocabulary
- **Verified:** directly supported by a checked source or completed CI run, within its stated scope.
- **Observed:** visible in UI/source metadata, but end-to-end behavior is not proven.
- **Partial:** some implementation or tests reviewed, coverage incomplete.
- **Unknown / excluded:** not inspected or cannot be established under current restrictions.
- **Not demonstrated:** target capability has no verified evidence in this review.

## P0 decision
This matrix is partial. It deliberately does not mark Supabase-backed isolation, ownership, persistence, deletion, report sharing, or approval enforcement as passed. P0 remains open until the permitted inventory and all acceptance artifacts are reconciled.
