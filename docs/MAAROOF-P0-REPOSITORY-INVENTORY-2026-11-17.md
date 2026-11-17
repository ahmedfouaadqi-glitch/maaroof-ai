# MAAROOF Ai — P0 Repository Inventory
**Date:** 2026-11-17  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`  
**Inventory head:** `eae28f38718f64520c6218ec5160b55df901f9bf`  
**Status:** PARTIAL — tree-level counts verified; semantic review incomplete.

## 1. Tree-level inventory
A recursive Git tree query returned `truncated=false`. Counts below are exact file counts for the named source prefixes at the recorded inventory head.

| Source prefix | File count | Inventory status |
|---|---:|---|
| `src/routes/**` | 66 | Tree counted; selected public routes statically reviewed |
| `src/components/**` | 205 | Tree counted; selected components reviewed at import/control-flow level |
| `src/lib/**` | 364 | Tree counted; selected pure modules/tests reviewed |
| `src/lib/mci/**` | Not separately counted in this pass | Selected foundation files reviewed |
| `src/lib/maaroof/**` | Not separately counted in this pass | Selected pure modules/tests reviewed; service files excluded |
| `docs/**` | Not separately counted in this pass | Selected architecture, audit and product-contract docs reviewed |

Counts are not counts of complete functionality, test coverage, or production-ready capabilities.

## 2. Route inventory

### Public routes reviewed statically
- `/`
- `/contact`
- `/guide`
- `/guide/what-is-geo`
- `/guide/geo-vs-aeo`
- `/guide/arabic-kurdish-geo`
- `/methodology`
- `/sitemap.xml`
- `/privacy`
- `/terms`

### Routes identified but not semantically reviewed
The route tree also includes admin, agent, auth, classic, dashboard, free-audit, maaroof, maaroof-memory, markets, profile, reset-password, pricing, tools, user pages, visibility-trial, workspace, API routes and Lovable integration routes. Routes that import Supabase/auth or call data-backed server functions were not followed beyond the exclusion boundary.

## 3. Component inventory — selected review
The component tree contains 205 files. Selected components reviewed at import or relevant control-flow level:
- Export: `ExportButtons.tsx`, `ToolResultExport.tsx`, `ReportBuilder.tsx`.
- Workspace: `WorkspaceSpacesPanel.tsx`, `WorkspaceAuditPulse.tsx`.
- Operations: `ApprovalQueue.tsx`, `ToolHistory.tsx`.
- Presentation: `LanguageSwitcher.tsx`, `MciReuseBadge.tsx`.

Important limitations:
- `ReportBuilder.tsx`, `WorkspaceAuditPulse.tsx`, and `WorkspaceSpacesPanel.tsx` import Supabase directly; review stopped at the service boundary.
- `ApprovalQueue.tsx` calls publishing server functions; service authorization was not inspected.
- `ToolHistory.tsx` exposes delete and clear-all operations; persistence and retention semantics remain unknown.
- This is not a complete 205-component review.

## 4. Library inventory — selected review

### Pure/domain helpers reviewed
- MCI: `context-budget.ts`, `context-selector.ts`, `freshness-gate.ts`, `evidence-gate.ts`, `context-provenance.ts`, `canonical-entity.ts`, `types.ts`, `registry.ts`.
- Workspace: `account-kinds.ts`, `space-structure.ts`, `workspace-scope.ts`, `workspace-panels.ts`.
- Operational: `monitor-policy.ts`, `brand-sanitize.ts`.
- Metrics: `visibility-metrics.ts`, `social-visibility-metrics.ts`.
- Export: `exports.ts`, `machine-pack.ts`, `export-bus.ts`, `export-content-translation.ts`, `export-identity.ts`, `task-export.ts`, `task-history-export.ts`.
- Domain: `action-plan.ts`, `action-policy.ts`, `agent-input.ts`, `chat-actions.ts`, `chat-policy.ts`, `domain-knowledge.ts`, `domain-ontology.ts`, `insight-engine.ts`, `recommendation-engine.ts`, `execution-evidence-pack.ts`, `execution-scheduler.ts`, `event-labels.ts`.

### Tests reviewed statically
Selected test files for the above modules include MCI foundation/registry, account kinds, workspace scope/panels/guard/isolation, export formats/translation/direction/PDF popup, visibility metrics, social metrics, action planning, agent input, chat actions/policy, domain knowledge/ontology, execution evidence/scheduler, and event labels.
The reviewed source tests were not run in this pass. The separate CI run on the baseline commit is documented in the P0 progress report.

### Libraries not reviewed
The remaining `src/lib/**` files have not been semantically reviewed. This includes server functions, integrations, provider adapters, API/auth code, and other modules that may cross excluded service boundaries. Do not infer behavior from filenames.

## 5. Configuration and workflow inventory
Reviewed:
- `package.json` scripts/dependency declarations (not dependency runtime behavior).
- `vite.config.ts` static configuration.
- `tsconfig.json`.
- `.gitignore`.
- `.github/workflows/validation.yml`.
- `public/manifest.webmanifest`.

Not opened:
- `.env` or any secret-bearing file.
- Supabase configuration, SQL, migrations or data.
- Cloudflare configuration or runtime paths.

## 6. Protected and excluded files
The eleven protected engine/catalog files are enumerated by SHA in the progress report. Their contents were not opened. Their current branch blob fingerprints were rechecked by metadata only.
All Supabase-dependent implementation is excluded by instruction. The exclusion is not a successful audit result.

## 7. Remaining inventory work
1. Complete semantic route/component/lib inventory for every permitted non-Supabase file.
2. Identify dependency edges and service boundaries without opening excluded source.
3. Map every feature to its route, component, pure helper, server function and test where permitted.
4. Reconcile this inventory with the prior partial P0 route, component and library reports.
5. Mark every inaccessible feature path as excluded/unverified, never as passed.
