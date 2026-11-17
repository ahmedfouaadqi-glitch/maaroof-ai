# MAAROOF Ai — P0 Test-to-Feature Mapping
**Date:** 2026-11-17  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Status:** PARTIAL — selected test sources mapped; no test command was executed during this static review.

## 1. Baseline CI evidence
GitHub Actions run `43970151448` at baseline commit `e0570879c5b4ca3f238f44e890df4b865da904ff` completed successfully:
- 127 test files passed.
- 677 tests passed.
- 3 tests skipped.
- Production build completed.
This is baseline CI evidence only. It is not a fresh run against the current documentation-only branch head and does not prove end-to-end service behavior.

## 2. Selected test-to-feature mapping

| Feature / helper | Test file(s) reviewed | What the tests cover | Important untested / unproven areas |
|---|---|---|---|
| MCI foundation | `src/lib/mci/__tests__/foundation.test.ts` | Canonical entity fingerprint, ordinary budget scaling, freshness examples, evidence gate/failure strategy, selector budget/provenance | Model window below 800, future timestamps, invalid reliability/tokens, duplicate IDs, runtime tool wiring |
| MCI registry | `src/lib/mci/__tests__/registry.test.ts` | Request fingerprint normalization, standard freshness window, tool profile defaults, agent stage cards | Future timestamps, malformed inputs, storage integration, actual reuse across workspaces |
| Account kinds | `src/lib/account-kinds.test.ts` | Seven kinds, base entity mappings, missing site/social presence notes | Real onboarding persistence and account ownership |
| Workspace scope | `src/lib/workspace-scope.test.ts` | Main-account vs selected-workspace row predicate | Every database query and server function, RLS, concurrent users |
| Workspace panels | `src/lib/workspace-panels.test.ts` | Month token aggregation and knowledge completion calculation | Ledger correctness from persistence, invalid dates, workspace query scoping |
| Workspace guard | `src/lib/workspace-guard.test.ts` | Mocked allow/reject behavior and accepted workspace field names | Real DB ownership enforcement, RLS, unauthorized access through all routes |
| Workspace isolation | `src/lib/workspace-isolation.test.ts` | MCI cache key difference by workspace, selected source-pattern guard | Comprehensive data isolation, real persisted records, every table/API route |
| Export formats | `src/lib/export-format-templates.test.ts` | Executive summary, CSV schema, Markdown escaping, JSON versioning, PPTX text chunking | XLSX six-sheet invalid names, DOCX/PPTX openability, PDF browser rendering, large files |
| Export direction | `src/lib/export-direction.test.ts` | Basic Arabic RTL, English LTR, numbers-only direction rule | Full document layout across all formats and mixed paragraphs |
| Export translation | `src/lib/export-content-translation.test.ts` | Translation planning, URL/code exclusions, path-based application, chunk bounds | Actual translation provider, server cost/failure, all AR/EN/KU output layouts |
| PDF popup | `src/lib/export-pdf-popup.test.ts` | Uses click-opened popup through async export path | Real browser print dialog, PDF output integrity and visual regression |
| Visibility metrics | `src/lib/maaroof/visibility-metrics.test.ts` | Standard sample metrics and selected denominators | Unexpected engine IDs, failed status with non-empty answer, contradictory mention flags |
| Social visibility metrics | `src/lib/maaroof/social-visibility-metrics.test.ts` | Selected social sample calculations | Source quality, missing/invalid data and broad edge-case coverage |
| Action planning | `src/lib/maaroof/action-plan.test.ts` | Planning helper behavior | End-to-end execution and authorization |
| Agent input | `src/lib/maaroof/agent-input.test.ts` | Input normalization/constraints | Authenticated service integration and workspace ownership |
| Chat actions | `src/lib/maaroof/chat-actions.test.ts` | Action mapping and selected safe behavior | Actual tool dispatch and service-side permission checks |
| Chat policy | `src/lib/maaroof/chat-policy.test.ts` | Policy decisions for supported scenarios | End-to-end enforcement on all server paths |
| Domain knowledge | `src/lib/maaroof/domain-knowledge.test.ts` | Selected domain knowledge retrieval/behavior | Full reference accuracy and external validation |
| Domain ontology | `src/lib/maaroof/domain-ontology.test.ts` | Acronym uniqueness, selected classifications and tool references | Completeness of all ontology rows and external standards |
| Execution evidence pack | `src/lib/maaroof/execution-evidence-pack.test.ts` | Evidence-pack normal cases | Overflow/truncation omission of failed/skipped items |
| Execution scheduler | `src/lib/maaroof/execution-scheduler.test.ts` | Selected scheduling/limit behavior | Actual background runtime, persistence and cancellation |
| Event labels | `src/lib/maaroof/event-labels.test.ts` | Label mapping and selected event names | Complete event coverage across all live workflows |

## 3. Test coverage limits and required additions
1. Add boundary tests for MCI budget, future timestamps, reliability and token counts.
2. Add visibility-metric tests for unexpected engines, failed status, and conflicting mention telemetry.
3. Add XLSX worksheet-name sanitization tests, including forbidden characters, duplicates and length boundaries.
4. Add evidence-pack overflow tests that assert every omitted limitation is represented.
5. Add workspace-switch and concurrent-session tests for export-bus isolation.
6. Add full-history pagination tests for report generation and export.
7. Add archive/restore and data-preservation tests before changing any deletion path.
8. Add browser-level export tests for PDF, HTML output, DOCX/PPTX/XLSX openability and RTL/LTR.
9. Add report approval and secure-link expiry/revocation tests when those phases are implemented.
10. Keep protected engine/catalog tests unchanged; run them as guardrails only when authorized and when the environment does not trigger paid/live operations.

## 4. Execution note
No tests were executed during this static review batch. The CI run cited above belongs to the baseline commit. Re-run the full suite and production build only after a code change batch is ready, using frozen dependencies and no paid/live integrations. Any Supabase-backed test requiring the prohibited service must remain excluded.
