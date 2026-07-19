# Part 5 — Cognitive Intelligence Platform (Evolution)

## Constitution self-review — what already exists

Before proposing anything, I mapped every Part 5 requirement to the current codebase. Nothing gets rebuilt.

| Part 5 requirement | Exists today | Decision |
|---|---|---|
| Memory separation (User / Workspace / Agent / Platform) | `maaroof_memory` with `kind` + `workspace_id` + `user_id`; `platform_intelligence_v` view; `maaroof_agents.dna` | **Evolve** — add a `scope` column (`user`/`workspace`/`agent`/`platform`) + a `consent_level` column; keep existing rows valid (default `scope='user'`). |
| User consent → don't store conversation/results/prompts, only DNA | Profiles/workspaces exist; no consent flag; orchestrator writes conversation-heavy memory rows | **Extend** — add `profiles.cognitive_consent` (`none`/`dna_only`/`full`, default `dna_only`); orchestrator branches on it. |
| Decision DNA / Reasoning / Planning / Execution / Capability / Learning / Cost / Future / Policy / Tool / MCP DNA | Partial: `maaroof_runs.decision_log`, `capability_scores_v`, `token_ledger`, `maaroof_agents.dna` | **Evolve** — one anonymized `platform_dna` table (kind + payload jsonb + weights). NOT per-DNA-kind tables (would be 12-table duplication). Existing decision_log is the source; a small extractor writes anonymized DNA rows post-run. |
| Platform Intelligence learns only best capabilities/experts/models/MCP/policies — no personal data | `capability_scores_v` already aggregates by capability | **Extend** the view family with `expert_scores_v`, `model_scores_v`, `mcp_scores_v`, `policy_scores_v` (SQL views over existing tables — no new writer paths). |
| Self Review per agent | Reflect phase exists in orchestrator | **Evolve** — expand reflect to emit a structured `self_review` block (necessary? wasted tokens? tool fit? cost/quality deltas) into `maaroof_runs.decision_log`. |
| Peer Review between agents | Not implemented | **Add** as an optional final step inside the existing Reflect phase when `peer_review_enabled=true`. Uses existing council pattern; no new module. |
| Expert Review (council re-evaluates plan/decisions/tools/results/cost) | Council exists pre-plan | **Extend** — reuse `runCouncil()` for a post-run pass gated by `expert_post_review_enabled`. Same function, second call site. |
| Final Reflection report (lessons/errors/opportunities) | Reflect writes summary memory | **Extend** — write a `kind='reflection'` memory row with structured fields; already supported by `maaroof_memory`. |
| AI Evolution Report (weekly/monthly/quarterly) | Not implemented | **Add** ONE server function `generateEvolutionReport(period)` reading existing views + `maaroof_runs` + `capability_scores_v`; store in new `maaroof_evolution_reports` table (period, generated_at, payload jsonb, admin-only RLS). This is genuinely missing. |
| **Maaroof Intelligence Center** admin section with 22 sub-panels | `MaaroofAdminTab.tsx` has agents/capabilities/replay sub-tabs; `SystemHealthTab`, `AdminFinanceTab`, `CognitiveInsightsTab`, `ProviderCostTab`, `UserIntelligenceTab`, `FirecrawlMonitorTab` all exist | **Evolve, do NOT duplicate** — the 22 requested panels already exist as separate admin tabs. Create a single `MaaroofIntelligenceCenter.tsx` **shell** that groups them under 22 named sections via a sidebar/menu, **reusing** the existing tab components as-is. New panels only for what's truly missing: Decision Center, Future Center, Policies Center, MCP Center, Audit Center, Documentation Center, Evolution Reports. |
| Per-section tables/charts/heatmaps/graphs/timeline/replay/exports | Replay & tables exist in `MaaroofAdminTab`; charts in Finance/Cognitive | **Extend** inside the missing panels only; reuse existing chart primitives. |
| Executive Dashboard (users, agents, workspaces, capabilities, cost, quality, confidence) | Numbers spread across existing tabs | **Add** ONE `ExecutiveDashboard.tsx` panel that aggregates counts from existing tables via a single admin server fn — no new tables. |
| Cost Intelligence (cost per agent/expert/capability/tool/mcp/model/workspace/user, ROI, margin, forecast) | `AdminFinanceTab` + `ProviderCostTab` cover most of it | **Extend** Finance tab with capability/agent/workspace breakdowns (already queryable from `token_ledger` + `maaroof_runs`). Forecast = simple 30-day rolling projection. |
| Security (RLS/Workspace isolation/policy/audit/HMAC/OAuth/encryption/secrets/rate limits) | RLS everywhere; policy validation exists; webhooks HMAC-verified; secrets in connectors | **Surface**, not build — a Security Center panel that displays the existing state (RLS coverage, recent audits from `activity_log`, secret age from connectors metadata). No new security primitives. |
| Documentation auto-generation (13 markdown files under `docs/`) | Only `docs/MAAROOF-AUDIT.md` exists | **Add** a documentation generator: single admin server fn that reads schema + tool catalog + capability registry and writes the 13 md files. Run manually from the Documentation Center panel. |

## What is preserved verbatim

- Every existing memory row, agent row, run row, ledger row, RLS policy, admin tab, orchestrator phase, SSE event, and translation key.
- Every existing admin panel remains reachable via its current path.
- Default consent = `dna_only` maps 1:1 to today's behavior for existing users (nothing new is stored *about* them; DNA extraction only runs when the toggle is opt-in, so a fresh install is byte-identical to Part 4).

## Scope of this change

### 1. Single additive migration
- `ALTER profiles ADD COLUMN cognitive_consent text default 'dna_only'` (nullable-safe, checked in {'none','dna_only','full'}).
- `ALTER maaroof_memory ADD COLUMN scope text default 'user', consent_level text default 'full'` — old rows read as `user`/`full`.
- `CREATE TABLE platform_dna (id, kind, payload jsonb, weight numeric, source_run_id nullable, created_at)` + GRANT + RLS admin-only. Anonymized: NO user_id, NO workspace_id.
- `CREATE TABLE maaroof_evolution_reports (id, period text, period_start, period_end, payload jsonb, created_at)` + admin-only RLS + GRANT.
- Views: `expert_scores_v`, `model_scores_v`, `mcp_scores_v`, `policy_scores_v` (all `security_invoker=on`).
- No table drops, no column drops, no policy tightening on existing tables.

### 2. Server logic (evolve existing modules; ONE new file only)
- **`src/lib/maaroof/memory.server.ts`** — respect `cognitive_consent`: `store()` skips conversation-heavy kinds when consent is `dna_only`; DNA extraction always writes to `platform_dna` (anonymized).
- **`src/lib/maaroof/orchestrator.server.ts`** — extend Reflect: emit `self_review` block; optional `peer_review` and `expert_post_review` gated by settings; write final reflection memory; call new DNA extractor.
- **`src/lib/maaroof/settings.server.ts`** — add flags `peer_review_enabled`, `expert_post_review_enabled`, `evolution_reports_enabled`, `platform_intelligence_enabled` (all default off → Part 4 behavior identical).
- **`src/lib/maaroof/cognition.server.ts`** — NEW, small helper. Only new file. Exports `extractDNA(run)` (writes anonymized DNA rows) and `generateEvolutionReport(period)`. Everything else lives in existing modules.

### 3. Admin surfaces (evolve — group, don't duplicate)
- **`src/components/admin/MaaroofIntelligenceCenter.tsx`** — NEW shell component with a 22-item sidebar. Each item renders an **existing** tab component (SystemHealthTab, AdminFinanceTab, ProviderCostTab, UserIntelligenceTab, CognitiveInsightsTab, FirecrawlMonitorTab, MaaroofAdminTab's Agents/Capabilities/Replay sub-tabs) or one of the small new panels below.
- New small panels (each ~150 lines, reusing existing UI primitives): `ExecutiveDashboardPanel`, `DecisionCenterPanel` (queries `decision_log`), `FutureCenterPanel` (workspace future_goal + envision output), `PoliciesCenterPanel` (workspace policies + risk profiles), `MCPCenterPanel` (existing `mcp_providers` table), `AuditCenterPanel` (existing `activity_log`), `DocumentationCenterPanel` (button to regenerate docs, lists last generation), `EvolutionReportsPanel` (list + generate).
- **`src/routes/admin.tsx`** — add one tab "مركز ذكاء معروف" that mounts `MaaroofIntelligenceCenter`. Existing tabs stay so nothing regresses.

### 4. User-facing consent UI (minimal)
- **`src/routes/profile.tsx`** — add a small "خصوصية الذكاء المعرفي" card with 3 radio options (none/dna_only/full). Reads/writes `profiles.cognitive_consent`.

### 5. Documentation generator
- Admin-only server fn `regenerateMaaroofDocs()` writes 13 files under `docs/` from live schema + tool catalog + capability registry + agent registry. Idempotent; safe to run repeatedly. `MAAROOF-AUDIT.md` is preserved (appended to, not replaced).

## Out of scope (deferred to Part 6+)
- Automatic scheduled evolution reports (cron). This lands as a manual button now; wiring `pg_cron` comes later.
- Full knowledge-graph visualization (nodes/edges renderer). Data model exists (capability graph); a heavy graph UI is Part 6.
- Encryption-at-rest key rotation UI — status display only for now.

## Post-implementation audit checklist
- Fresh install with all new flags **off** and `cognitive_consent='dna_only'` reproduces Part 4 behavior byte-for-byte.
- Every "new" admin panel that references an existing tab renders the existing component unchanged; no duplicate component was created.
- `platform_dna` contains zero user_id/workspace_id columns; RLS blocks all non-admin reads.
- `docs/` regeneration preserves `MAAROOF-AUDIT.md` history.
- No renamed/removed tables, columns, RLS policies, SSE events, or translation keys.
