# Part 6 — Platform Evolution (Fusion, not Rebuild)

Following the Constitution: every requirement below maps to something that already exists and gets **evolved**. Nothing is rebuilt. One new table only where no home exists.

## Constitution audit — requirement → current asset → decision

| Part 6 requirement | Exists today | Decision |
|---|---|---|
| Discovery Engine (search before create) | Constitutional workflow only | **Process** — encode as pre-implementation checklist in `.lovable/plan.md`. No code. |
| Fusion Architecture pipeline (Discover→…→Document) | Orchestrator has Envision→Plan→Council→Act→Reflect | **Extend** — add `discover`/`measure`/`document` SSE phase labels; no new engine. |
| System Preservation | Entire codebase | **Policy** — no deletions in this part. |
| **Simulation Engine** | `src/components/WhatIfSimulator.tsx` + `src/routes/api/what-if.ts` + `whatif_scenarios` table | **Evolve** — promote existing What-If into `Future Decision Simulator`. Add scenario axes (market/competitors/costs/time/risks/growth/agent-decisions/tools/MCP/models) as optional inputs; add `kind` column to `whatif_scenarios` (`market`/`plan`/`decision`/…, default `market`). Reuse the endpoint and component. |
| **Execution Modes** (Simulation / Recommendation / Execution) | `maaroof_runs` has `queue_state`; orchestrator runs directly | **Extend** — add `execution_mode text default 'execution'` (check in `simulation`/`recommendation`/`execution`) to `maaroof_runs`. Orchestrator branches: `simulation` stops after Envision+Council with a scenario written to `whatif_scenarios`; `recommendation` stops after Plan with a proposal memory row + human-approval SSE event; `execution` = current path. UI toggle in `/maaroof` chat composer (three-way switch). |
| **Capability Marketplace** | `src/lib/tool-catalog.ts` (Capability Registry with implementations[]) + `capability_scores_v` | **Evolve into surface** — add a `CapabilityMarketplacePanel` under Intelligence Center that lists capabilities, compares implementations side-by-side (cost, quality, latency, risk from `capability_scores_v`) and lets admins pin a preferred implementation per capability into `app_settings` key `capability_preferences`. No new registry. |
| **Plugin SDK** | Capability Registry + `mcp_providers` + agent definitions in DB | **Evolve** — expose one typed contract file `src/lib/maaroof/plugin-sdk.ts` re-exporting existing registration helpers (`registerCapability`, `registerAgent`, `registerMcp` as thin wrappers over existing inserts) + a `docs/PLUGIN-SDK.md` spec. Kernel unchanged. |
| **Workflow Graph Engine** (branches/loops/approvals/parallel/retry/rollback/pause/resume/human/agent/mcp/tool tasks) | `maaroof_schedules` already has `capabilities`, `conditions`, `approval_rules`, `retry_rules`; `agent_tasks` has parent/depends; orchestrator queues sub-runs via `parent_run_id`/`depends_on_run_id` | **Evolve** — add `workflow_graph jsonb` column to `maaroof_schedules` (nodes+edges). New helper `src/lib/maaroof/workflow.server.ts` interprets the graph by dispatching to the existing orchestrator, existing MCP dispatcher, and existing approval queue — no parallel engine. Add `workflow_state` (`pending`/`running`/`paused`/`awaiting_approval`/`done`/`failed`/`rolled_back`) to `maaroof_runs`. Reuse existing SSE `graph` event to stream node transitions. |
| **Future Graph** (Goal → Vision/Objectives/Milestones/Capabilities/Agents/Experts/Knowledge/Memory/Models/MCP/Simulation/Costs/Timeline/Risks/Confidence) | Envision phase already produces vision+goals; workspace has `future_goal`, policies, risk profile | **Evolve** — Envision writes a structured `future_graph` block into `maaroof_memory` (scope=workspace, kind=`future_graph`, payload jsonb) with all 15 dimensions filled from existing sources (capability registry, agents table, capability_scores_v, whatif_scenarios). Render read-only in `FutureCenterPanel` (already scoped in Part 5 plan). |
| **Executive Quality Score** (11 dimensions) | Reflect writes summary; `capability_scores_v` covers cost/success | **Evolve** — Reflect emits a `quality_score jsonb` (decision/planning/expert/capability/memory/simulation/execution/reflection/learning/cost_efficiency/user_satisfaction each 0–1) stored on `maaroof_runs.quality_score`. Aggregate view `run_quality_v` for admin. Add column to `maaroof_runs`. |
| **Zero Regression Policy** | Constitution | **Process** — plan.md checklist + typecheck before finalize. |
| **Self Audit** after each phase | Part 5 added structured self_review to decision_log | **Extend** — add optional `technical_debt`, `duplicates_found`, `better_design` fields to the self_review block. No new writer. |
| **Document Synchronization** | Part 5 added `regenerateMaaroofDocs()` server fn | **Extend** — include new artifacts (workflow graph schema, plugin SDK, execution modes) in the same generator. No new generator. |

## Additive migration (single migration)

1. `ALTER TABLE maaroof_runs ADD COLUMN execution_mode text NOT NULL DEFAULT 'execution' CHECK (execution_mode IN ('simulation','recommendation','execution'))`
2. `ALTER TABLE maaroof_runs ADD COLUMN workflow_state text` (nullable — only set when driven by workflow graph)
3. `ALTER TABLE maaroof_runs ADD COLUMN quality_score jsonb`
4. `ALTER TABLE maaroof_schedules ADD COLUMN workflow_graph jsonb`
5. `ALTER TABLE whatif_scenarios ADD COLUMN kind text NOT NULL DEFAULT 'market'` + `ADD COLUMN axes jsonb`
6. `CREATE OR REPLACE VIEW run_quality_v` (security_invoker=on) aggregating `quality_score` averages per agent/capability
7. No new tables. No RLS changes. Existing rows remain valid (all new columns nullable or defaulted).

## Code changes (evolution only)

- **`src/lib/maaroof/settings.server.ts`** — add flags: `simulation_engine_enabled`, `execution_modes_enabled`, `workflow_graph_enabled`, `quality_score_enabled`, `capability_marketplace_enabled`. All default **off** → Part 5 behavior byte-identical.
- **`src/lib/maaroof/orchestrator.server.ts`** — branch on `execution_mode`; emit `discover`/`measure`/`document` SSE labels; write `future_graph` memory row from Envision; compute `quality_score` in Reflect. All additive, guarded by flags.
- **`src/lib/maaroof/workflow.server.ts`** — NEW small interpreter (one file). Reads `workflow_graph`, dispatches nodes via existing orchestrator/MCP/approval-queue. No parallel engine.
- **`src/lib/maaroof/plugin-sdk.ts`** — NEW re-export module (one file). Thin wrappers only.
- **`src/routes/api/what-if.ts`** — accept optional `axes` and `kind`; existing shape still works.
- **`src/components/WhatIfSimulator.tsx`** — add collapsible advanced axes; unchanged for basic users.
- **`src/routes/maaroof.tsx`** — three-way execution-mode switch above composer (default `execution`).
- **`src/components/admin/MaaroofIntelligenceCenter.tsx`** — mount three new small panels (`CapabilityMarketplacePanel`, `FutureCenterPanel` completing Part 5 stub, `WorkflowGraphPanel`) plus quality tab. Each reuses existing charts/tables.
- **`src/lib/maaroof/cognition.server.ts`** — extend `regenerateMaaroofDocs()` to write `docs/PLUGIN-SDK.md`, `docs/WORKFLOW-GRAPH.md`, `docs/EXECUTION-MODES.md`, `docs/FUTURE-GRAPH.md`, `docs/QUALITY-SCORE.md` from live schema.

## Backward compatibility guarantees

- Every new column is nullable or defaulted so existing writes keep working.
- Every new behavior sits behind a settings flag defaulted **off**. Fresh install = Part 5 exactly.
- No renames, no deletions, no policy tightening.
- `/api/what-if`, `/api/maaroof`, all tool endpoints keep their current request/response shape.
- The three new SDK exports wrap existing DB inserts — no kernel change.

## Out of scope (deferred)

- Full visual graph editor UI (drag-drop nodes). Data model + JSON editor only in Part 6.
- Rollback of arbitrary tool side-effects — workflow rollback covers state marker + compensating agent tasks, not third-party APIs.
- Auto-selection of execution_mode by risk score — always user-chosen in Part 6.

## Post-implementation audit checklist

- Flags all off ⇒ Part 5 byte-identical (chat, memory writes, admin tabs).
- No table dropped, no column dropped, no policy loosened.
- `docs/` regen still preserves `MAAROOF-AUDIT.md`.
- `capability_scores_v`, `expert/model/mcp/policy_scores_v` still return rows.
- `WhatIfSimulator` legacy calls (without `axes`/`kind`) still succeed.
- Typecheck clean; no duplicate registries, engines, or endpoints introduced.
