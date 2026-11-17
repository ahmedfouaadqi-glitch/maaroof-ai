# MAAROOF Ai — P0 Review Progress
**Date:** 2026-11-17  
**Repository:** `ahmedfouaadqi-glitch/maaroof-ai`  
**Working branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Baseline:** `e0570879c5b4ca3f238f44e890df4b865da904ff`  
**Status:** P0 remains OPEN — this is an incremental evidence log, not the P0 acceptance report.

## 1. Repository and branch verification
- GitHub repository metadata confirms the repository and the default branch `main`.
- Comparing the working branch to the baseline commit returns `identical`, `ahead_by=0`, `behind_by=0`, and no changed files.
- No application code was changed during this review.
- The eleven protected model/catalog files remain outside source inspection. Their previously recorded blob SHA manifest must be rechecked after any future commit.

## 2. CI evidence verified directly
Workflow run **2019**, run ID `43970151448`, workflow `Validate Maaroof`, was fetched from GitHub Actions:
- Head SHA: `e0570879c5b4ca3f238f44e890df4b865da904ff`.
- Conclusion: `success`.
- Frozen dependency install completed: 725 packages installed.
- Unit tests: **127 test files passed; 677 tests passed; 3 skipped (680 total)**.
- Production build: completed successfully (`built in 14.71s`).
- The build emitted warnings, including deprecated TanStack `inputValidator()` usage and dependency-level ignored `use client` directives. These are recorded as warnings, not treated as build failures.
- This CI result verifies only this exact baseline commit. It does not verify future modifications or end-to-end production behavior.

## 3. Additional static source review

### 3.1 MCI foundation
Reviewed: `context-budget.ts`, `context-selector.ts`, `freshness-gate.ts`, `evidence-gate.ts`, `context-provenance.ts`, `registry.ts`, `canonical-entity.ts`, `types.ts`, and their two test files.
- **Confirmed boundary inconsistency:** `computeContextBudget` applies a 200-token minimum after capping to 25% of model context. For a model window below 800, the returned minimum can exceed the quarter-window cap.
- **Validation gap:** `passesFreshness` checks finite timestamps and upper age but does not reject future timestamps explicitly.
- **Validation gap:** `selectContext` accepts caller-provided `reliability` and `tokens` without enforcing documented numeric ranges/finite non-negative values.
- **Behavior to confirm:** `stage` is accepted by `selectContext` and recorded in provenance but does not affect ranking.
- The existing MCI tests cover normal cases, not these boundary conditions. Tests were not run in this review session.

### 3.2 Monitoring policy
Reviewed: `src/lib/monitor-policy.ts`.
- Numeric policy values are coerced with `Number` and clamped, but explicit finite/integer validation is absent in this pure resolver.
- The source of overrides and endpoint enforcement were not followed because that would cross service/data boundaries. Treat as a candidate validation gap, not a proven exploitable defect.

### 3.3 Evidence, recommendation, action planning, and scheduling
Reviewed pure modules and selected corresponding tests:
- `action-plan.ts`, `action-policy.ts`, `agent-input.ts`, `chat-actions.ts`, `chat-policy.ts`.
- `insight-engine.ts`, `recommendation-engine.ts`, `execution-evidence-pack.ts`, `execution-scheduler.ts`.
- `event-labels.ts`, `domain-knowledge.ts`, `domain-ontology.ts`.
- Existing tests verify selected dependency ordering, no-execution planning, approval gates, evidence requirements, bounded rewrite source extraction, language labels, task escalation markers, and ontology/tool-key integrity.
- These are pure-module tests and do not prove service authorization, workspace scope, real tool execution, or persistence.

### 3.4 Visibility and social metrics
Reviewed: `visibility-metrics.ts`, `social-visibility-metrics.ts` and their tests.
- **Candidate metric-integrity issue:** `calculateVisibilityProbeMetrics` counts every non-empty input answer by normalized engine key, without checking that the engine belongs to `requestedEngines`; it also does not use the optional answer `status` field when deciding whether a response succeeded. An unexpected engine or a failed-status record with non-empty text may affect coverage and derived metrics.
- **Candidate semantic ambiguity:** `mentioned === false` does not prevent text matching from marking the brand mentioned, because the implementation also searches the answer text. The intended precedence of explicit boolean telemetry versus text inference needs a contract decision.
- The current tests cover ordinary samples, duplicates indirectly, denominators, citations and ranking, but not unexpected engine IDs or contradictory status/mention fields.
- Social metrics explicitly leave share of voice null when no comparable competitor denominator exists; that guardrail is appropriate.

### 3.5 Report/export utilities
Reviewed: `exports.ts`, `machine-pack.ts`, `export-bus.ts`, `task-export.ts`, `task-history-export.ts`, `export-content-translation.ts`, `export-identity.ts`, and `report-sections.ts).
- Existing export paths are present for PDF/browser print with HTML fallback, XLSX, CSV, JSON, Markdown, DOCX and PPTX, plus machine-pack outputs. These must be preserved.
- **Cross-workspace candidate risk:** `export-bus.ts` stores the latest captured result in a module-global map keyed only by tool key; the reviewed contract has no workspace key. Consumer lifecycle and isolation must be checked before any change.
- **Excel candidate defect:** the `six_sheets` branch passes section headings directly to `workbook.addWorksheet` after truncation/deduplication, while the ordinary workbook path sanitizes Excel-invalid sheet-name characters. Runtime reproduction and a regression test are still required.
- **Evidence-pack candidate gap:** when the execution-limitations section does not fit the character budget, failed/skipped items are not counted in `omitted` and no explicit failure-omission note is added. Current tests do not cover this overflow case.
- `task-history-export.ts` reconstructs from the event array it receives; complete export still depends on the caller retrieving every event page.
- No generated export round-trip, browser print, visual rendering, large-file, or AR/EN/KU end-to-end checks were run in this review.

### 3.6 Domain knowledge
- `domain-ontology.ts` explicitly states that the seed is not a complete 119-row import until the source workbook is reconciled.
- The ontology distinguishes standardized, established, variable, ambiguous, and historical terms. This is a useful safeguard against treating project-specific terms such as SGEO as universal standards.
- Existing tests verify unique acronyms, linked tool names, selected classifications, and retrieval examples; they do not validate the completeness or current accuracy of every external reference.

## 4. Previously recorded high-risk paths requiring later permitted review
The existing P0 evidence log identifies:
- Automatic trimming/deletion of old tool history beyond a per-tool cap.
- Physical workspace deletion and possible descendant cascades.
- ReportBuilder limits on historical records and metric rows.
- Session export-bus lacking workspace identity.
- Workspace scoping of reports/templates/drafts not yet proven.
These findings must be re-traced through their consumers and contracts before P1 changes. Do not alter them during P0.

## 5. Explicit exclusions and unresolved boundaries
- Supabase is excluded completely by the user's instruction: no project connection, queries, schemas, policies, migrations, secrets, or data inspection. All Supabase-dependent ownership/isolation claims remain **unverified/excluded**, not passed.
- Protected engine/catalog source and test files are not opened or modified.
- No secrets or `.env` values were opened or displayed. The repository root listing includes a tracked `.env` path; its contents remain uninspected. This is a security review item requiring a safe local method and must not be resolved by exposing values in logs or chat.
- Server/API paths that require auth, storage, database, or service inspection remain outside this static batch.
- No paid/live probes, external writes, database migrations, deployments, or merges were performed.

## 6. P0 status and next work
P0 remains **OPEN**. This batch adds verified CI evidence and additional static source findings, but it does not complete the required repository inventory, architecture/dependency map, full test-to-feature map, export validation, or risk review. The next P0 work is to continue the permitted non-Supabase source and test inventory, reconcile all prior partial reports, and produce the five acceptance artifacts: Repository Inventory, Architecture Map, Risk Register, Feature Matrix, and Protected Files Manifest.

No P1 work may begin until the P0 acceptance gate is explicitly satisfied.