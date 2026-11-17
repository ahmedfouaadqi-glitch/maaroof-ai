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

## 7. Additional documentation, configuration, and export-test review

### 7.1 Historical MCI documentation reconciliation
- `docs/MCI_AUDIT.md` describes MCI as active in selected tools, with user-scoped reuse/cache and fail-open behavior. The current `src/lib/mci/index.ts` describes the MCI foundation as "not yet wired into tools". These statements may refer to different MCI generations or layers; the actual runtime wiring is not established by this pure-module batch. Reconcile against permitted call sites only; do not inspect Supabase-backed storage or protected engine files.
- `docs/EXECUTION-MODES-PROOF.md` records a historical authenticated preview test (2026-09-22) showing recommendation/simulation modes produced zero tool calls. It is historical runtime evidence, not proof of current behavior at the reviewed commit.
- `docs/SGEO-DEFINITION.md` aligns with the domain ontology: SGEO is a derived overlap index over SEO/AEO/GEO/SGE, separate from the existing GSEO axis and excluded from the weighted total to avoid double counting.
- `docs/ai-visibility-probe-metrics.md` documents the same observed-sample limits and denominators found in the metric implementation. This documentation makes the implementation's treatment of status fields and requested engine sets worth validating against the exact intended input contract.

### 7.2 Configuration
- `.gitignore` does not contain an explicit `.env` ignore rule. The repository root listing exposes a tracked `.env` path, but its contents were not and must not be opened in this review. Treat as a **high-priority secret-exposure verification item**, not proof that a live credential is valid or exploitable. Any response must use a safe local secret-scanning/rotation procedure without copying values into logs, chat, or commits.
- `tsconfig.json` enables `strict: true`, `noEmit: true`, and disables `noUnusedLocals` / `noUnusedParameters`. No typecheck command was run independently in this review.
- The validation workflow runs frozen Bun install, Vitest unit tests, and production build on pushes to `main`, `fix/**`, `feat/**`, and pull requests. It has no explicit lint or standalone typecheck step in the reviewed workflow file.

### 7.3 Export regression-test coverage
- `export-format-templates.test.ts` covers CSV, Markdown, JSON, executive summary, and PowerPoint text splitting.
- `export-content-translation.test.ts` covers protected machine-readable sections, URLs, chunk bounds, and path-based translation.
- `export-pdf-popup.test.ts` covers the pre-opened popup path.
- `export-direction.test.ts` covers basic RTL/LTR selection.
- The reviewed tests do not establish browser-level PDF print fidelity, DOCX/PPTX openability, XLSX worksheet-name edge cases, six-sheet layout validity, very large payload behavior, or historical event pagination. Those remain explicit validation gaps.
- The normal XLSX worksheet-name sanitizer exists in the standard workbook branch; the six-sheet branch is a separate code path and does not visibly apply that sanitizer before `addWorksheet`. Reclassify the earlier candidate as a path-specific issue requiring a regression test, not as a confirmed runtime failure.

## 8. Updated P0 position
P0 remains **OPEN**. The review has now added:
- Verified CI result for the exact baseline commit.
- Static findings across MCI, pure execution/evidence modules, metric calculators, export utilities, tests, docs and top-level configuration.
- Explicit separation of verified evidence, static observations, candidate defects, and excluded service/database boundaries.

Still outstanding:
1. Complete the non-Supabase source inventory and dependency map.
2. Reconcile the historical MCI wiring claims against current permitted call sites.
3. Complete the export consumer/lifecycle review and determine whether the session-global export bus can mix workspaces in actual UI usage.
4. Trace non-Supabase deletion/archive paths and tool-history retention logic without crossing the excluded data-service boundary.
5. Complete route/component/test-to-feature matrices to the extent possible under the Supabase exclusion.
6. Finalize the five P0 artifacts and mark every excluded or unverified area explicitly.

No application code, configuration, credentials, database, deployment, or main-branch content was changed.

## 9. Public route inventory — static first pass

The top-level route directory was enumerated. The following public-facing route files were reviewed at source level without entering API, auth, workspace, or database handlers:
- `/` (landing), `/contact`, `/guide`, `/guide/what-is-geo`, `/guide/geo-vs-aeo`, `/guide/arabic-kurdish-geo`, `/methodology`, `/sitemap.xml`, `/privacy`, `/terms`.
- `/pricing` was identified but not followed beyond imports because it directly imports the Supabase client and auth provider, which are excluded from this review.
- The landing route wraps both landing experiences in `AuthProvider`; its transitive auth/service behavior was not inspected.
- `/contact` reads dynamic contact details through `useContactInfo`; the source of those values was not traced because that could cross service/config boundaries.
- `/sitemap.xml` delegates to the pure `buildPublicSitemapXml` helper; helper implementation and route output were not runtime-tested.
- `/privacy` and `/terms` render localized HTML through DOMPurify. Their text contains product/data-handling assertions; static copy is not technical evidence that the described controls are implemented.
- Public pages expose canonical URLs, Open Graph metadata and JSON-LD. The homepage SoftwareApplication description explicitly says "10 AI search engines", consistent with the protected ten-engine requirement; this is not a review of the protected catalog.
- `/methodology` publicly describes verification states and evidence chains. It should be treated as a product promise to be checked against implementation and report contracts in later permitted review, not as proof by itself.

### Route review limitations
- No route was invoked in a browser, no SSR output was inspected, and no accessibility, localization-switching, metadata validation, sitemap URL reachability, or structured-data validation was performed.
- Authenticated routes, API routes, Lovable integration routes, profile/user routes, workspace routes, admin routes and dynamic data-backed pages remain unreviewed because their call chains may enter excluded authentication or Supabase services.
- This route batch is a partial public-route inventory only; it does not close the P0 requirement to map all routes and their dependencies.

## 10. Workspace rules and component-level data-lifecycle review

### 10.1 Pure workspace and account rules
Reviewed:
- `account-kinds.ts` and tests: exactly seven account kinds are defined and tested; each maps to a base entity type. Presence notes distinguish missing website/social links.
- `space-structure.ts`: pure tree rules define company → product/subsidiary/client, subsidiary/client → product, and product as a leaf. `descendantIds` is cycle-safe. Space caps are 1/5/10/25/100 for free/pro/premium/business/enterprise, with unknown tiers falling back to free.
- `workspace-scope.ts`: pure row predicate distinguishes the main account (null workspace) from a selected workspace. Tests cover basic matching and non-matching cases.
- `workspace-panels.ts`: pure monthly token ledger aggregation and knowledge-completion percentage. Tests cover month totals and simple completion cases.
These pure helpers establish intended rules only; they do not prove that every server query or persisted record enforces them.

### 10.2 Isolation tests — scope limitation
- `workspace-isolation.test.ts` checks workspace-specific MCI cache keys and checks selected source files for a profile-brand write pattern. It reads source files and calls server-side helpers.
- `workspace-guard.test.ts` uses a mocked query-builder object to test allow/reject outcomes.
- These tests are useful unit evidence but do not prove actual database row-level security, authorization under real sessions, or isolation of every table and server function. Those checks are explicitly excluded because the relevant boundary is Supabase-backed.
- Do not describe workspace isolation as fully verified until permitted evidence covers all non-excluded layers; under the current Supabase prohibition, persisted isolation remains unverified.

### 10.3 Component-level destructive and export flows
Reviewed component imports and relevant control paths:
- `ToolHistory.tsx` exposes per-item deletion and clear-all history actions through `deleteToolResult` and `clearToolHistory`. The server implementations were not opened. Retention, soft-delete vs hard-delete, ownership checks, and cascade effects are therefore **unknown**.
- `WorkspaceSpacesPanel.tsx` exposes a delete action with a confirmation message explicitly warning that the selected space and descendants will be deleted; it computes descendant IDs client-side and calls `deleteWorkspace`. The persistence behavior, cascade boundaries, restoration path and treatment of associated reports/files/history are **unknown** due the excluded service boundary. This is a P0 high-priority data-preservation risk.
- `ReportBuilder.tsx` imports the Supabase client directly, plus tool-history functions and the export bus. It was not inspected beyond its import boundary. Workspace scoping of its database metrics and report data remains excluded/unverified.
- `WorkspaceAuditPulse.tsx` imports the Supabase client directly and is not reviewed beyond its import boundary.
- `ApprovalQueue.tsx` uses server functions for listing, approving/publishing and rejecting. The service implementation and authorization are not reviewed.
- `ExportButtons.tsx` uses pure format renderers and export configuration, but also calls a translation server function. UI behavior, language completeness and server translation cost/error handling are not end-to-end verified.
- `ToolResultExport.tsx` captures tool results into the export bus and invokes tool-history persistence; the service persistence contract remains unverified.

### 10.4 Confirmed export-bus scope concern
The pure `src/lib/export-bus.ts` implementation uses a module-global `Map<string, CapturedResult>`, where the key is only `toolKey`. Its own comment describes it as a session-wide bus for combining live tool results with report metrics. No workspace or owner key is present in the map key or captured-result shape.
- **Confirmed implementation fact:** one captured result per tool key is held in the current JavaScript module instance, regardless of workspace identity passed to this helper (there is no workspace parameter).
- **Risk assessment:** if one application session switches between workspaces and the Report Builder reads this same bus, the latest result for a tool can be surfaced in a different workspace's report. This is a credible cross-workspace contamination risk; actual UI lifecycle and report inclusion must be verified before classifying it as an observed leak.
- No code change was made. The future fix must preserve existing export behavior while adding an explicit workspace/owner scope and tests for switching between workspaces.

### 10.5 Deletion policy conflict to resolve before P1
The approved project constraint is to preserve customer data, history and reports. The UI currently exposes hard-sounding delete operations for tool history and workspace trees. Until service behavior is verified within an allowed boundary, do not assume these are hard deletes or safe soft deletes. P1 must not introduce any deletion, cascade or cleanup behavior; any required removal should be reversible/archive-first and retain dependent records unless explicitly authorized.

## 11. Updated P0 remaining-work list
1. Finish the allowed source inventory and architecture/dependency map without crossing Supabase/auth/data-service exclusions.
2. Review pure workspace-related tests and static callers more comprehensively; avoid server implementation files that cross the prohibited service boundary.
3. Resolve the MCI historical-documentation versus current-foundation wording with a permitted call-site inventory.
4. Map the exact report/export data flow, including export-bus consumers, without opening excluded persistence services.
5. Complete route/component/test-to-feature mapping for the permitted scope.
6. Reconcile prior P0 drafts into the five acceptance artifacts and mark all excluded controls as unverified.
7. Reconfirm the eleven protected file blob SHAs before any future code-writing phase.

P0 remains **OPEN**. No application code, database, auth configuration, secrets, or deployment were changed in this batch.

## 12. Repository-tree metadata and protected-file fingerprint checkpoint

A recursive Git tree was retrieved at current branch head `eae28f38718f64520c6218ec5160b55df901f9bf`. The tree response was complete (`truncated=false`). This was metadata-only; no protected file contents were opened.

Current source-tree counts:
- `src/routes/**`: **66 files**.
- `src/components/**`: **205 files**.
- `src/lib/**`: **364 files**.

The eleven protected files were re-enumerated by blob SHA only. Their current fingerprints are:
| Protected path | Current blob SHA |
|---|---|
| `src/lib/ai-engines.ts` | `f6897e7d3433d9330fa9a5e55e6ae368418094c8` |
| `src/lib/ai-engines.server.ts` | `2fcf077f8b229cd6a668acb1b95785534784f82a` |
| `src/lib/maaroof/tool-council.ts` | `4b1f80d59ac3ed1f252f58b5904133b454dfa1e7` |
| `src/lib/maaroof/tool-council.server.ts` | `cf4448710a2e4c6dd20752c8e03eb53e1430275e` |
| `src/lib/maaroof/probe-answer.ts` | `d06107fe2bc654af1a26c52dbfb33c6537690813` |
| `src/lib/__tests__/ai-engines-catalog.test.ts` | `d89f1804e9bb23c387fab2920ec1d63709278796` |
| `src/lib/__tests__/council-engines.test.ts` | `7d549bd387a02065952d4b53ebd6b111c926d0ab` |
| `src/lib/__tests__/ten-model-probe.test.ts` | `76b1a94cb209501459d3e96110b9a5c9532194d9` |
| `src/lib/maaroof/probe-answer.test.ts` | `62048558972c11431a85b5fa2a3640fbafd30d99` |
| `src/lib/maaroof/tool-council.test.ts` | `e6b39d11a7dd087d813a6cc032ba1aab694de3bb` |
| `src/lib/maaroof/tool-council-fallback.test.ts` | `cf588f98e8d397ebf47a9447cd8853dd008d85e2` |

These are current branch fingerprints, not a claim of historical immutability unless compared to the previously archived manifest. Protected contents remain unopened and untouched.