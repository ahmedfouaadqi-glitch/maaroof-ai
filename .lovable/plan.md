# Part 4 — Capability Operating System (Evolution)

## Constitution self-review

Mapped every Part 4 requirement to what already exists before writing this plan. Nothing gets replaced — the existing Capability Registry (`src/lib/tool-catalog.ts`), Expert Council (in `orchestrator.server.ts`), Agent Factory (`maaroof_agents`), Envision phase, memory blending, and cost/token pipeline all stay; new work becomes a thin layer around them.

| Part 4 requirement | Existing today | Decision |
|---|---|---|
| Capability Registry as abstraction layer between Maaroof → Experts → Tools → MCP → Models | `TOOL_CATALOG` + `Capability` union + `findExpertsByCapability` / `pickExpertForCapability` | **Evolve** — expand `ToolDef` metadata (avg cost/quality/time/risk/confidence/policies), and introduce `CAPABILITY_REGISTRY` map derived from the same catalog. No new table, no duplicate registry. |
| Capability metadata (required knowledge/experts/tools/mcp/models/policies, avg cost/quality/time, risk, confidence, learning score) | Partial (`capabilities`, `preferredModels`, `costProfile`, `strengths`, `weaknesses`) | **Extend** the existing per-tool DNA with optional fields; add derived per-capability aggregates in a pure helper file. |
| Capability Graph (Goal → Capabilities → Experts → Agents → Tools → MCP → Execution) | Orchestrator already computes required capabilities from plan + council picks experts | **Evolve** — extract the implicit graph into an explicit `buildCapabilityGraph()` helper reused by orchestrator, admin (replay), and the `graph` SSE event. |
| AUTO / PREFERRED / FORCED modes per capability | `workspaces.preferred_experts` (preferred) exists; no forced/auto distinction | **Extend** — add `capability_mode` on workspace profile (default AUTO) and a per-run override on `maaroof_runs.decision_log`; enforce inside existing expert-pick step. Additive, backward-compatible default = AUTO. |
| Capability Score (success rate, failure rate, avg cost/duration/quality, confidence, popularity, learning trend) | `token_ledger` per tool, `maaroof_runs` per run, `maaroof_agents.success_rate` per agent | **Evolve** — add SQL view `capability_scores_v` aggregating existing rows by capability (join tool ↔ capability from the static catalog exposed as a small `capability_tool_map` seed table only if a view can't derive it cleanly; prefer the view). No new writer path — reads only. |
| Capability Selection (best implementation among alternatives) | `pickExpertForCapability` picks by cost profile only | **Extend** the same function to blend live scores from `capability_scores_v` when available, falling back to today's rule when scores are missing. |
| Decision Engine grounded in graph + council + memory + policies + workspace + future goal + confidence + cost | All these exist; decision assembly is implicit | **Evolve** — formalize `assembleDecision()` inside orchestrator that writes a single structured entry into the existing `maaroof_runs.decision_log` per phase (already used). No new table. |
| Decision Confidence breakdown (overall/knowledge/memory/expert/capability/tool/model/future) | Council confidence + agent confidence already recorded | **Extend** the same `confidence` jsonb on `maaroof_runs`/`maaroof_agents` with sub-scores. Existing `needs_human` SSE trigger keeps working. |
| Decision Replay (why each capability/expert/tool/mcp/agent/memory/plan/cost) | `decision_log` jsonb on `maaroof_runs` already stores per-phase entries | **Evolve** — add a Replay sub-panel inside the existing `MaaroofAdminTab` (no new page) that renders `decision_log` as a step-by-step timeline. Optional filter by run. |
| Explainability | Same `decision_log` + council rationale | **Surface** the existing data — no schema change. |
| Queue architecture (validation → queue → planner → capability builder → council → sub-agent factory → execution → reflection → learning → response) with priority/retry/DLQ/scheduled/parallel/rate-limit/cancel/pause/resume | `maaroof_schedules` (cron), `agent_tasks` (background), `user_agent_subscriptions` (limits), `maaroof_runs` (execution) already model a linear queue implicitly | **Evolve** — add lifecycle columns on `maaroof_runs`: `queue_state` (`queued/running/paused/cancelled/failed/succeeded/dead_letter`), `priority`, `attempts`, `next_attempt_at`, `parent_run_id`. No new queue table; existing SSE loop is the runner. Add a small `enqueue()` wrapper in orchestrator that stamps these fields. Pause/resume/cancel become admin actions updating `queue_state`. |
| Scheduler = independent Agent (goal/workspace/policies/capabilities/experts/cost limit/token limit/retry/approval/learning/history) | `maaroof_schedules` already has goal/workspace/language and links to runs | **Extend** with optional columns: `capabilities` (jsonb), `cost_limit_usd`, `token_limit`, `retry_rules` (jsonb), `approval_rules` (jsonb). Existing scheduler flow keeps working when they're null. |
| Background execution (recurring/delayed/parallel/conditional/workflow dependencies) | `maaroof_schedules.cron` + `agent_tasks` | **Extend** — add `depends_on_run_id` on `maaroof_runs` and a `conditions` jsonb on `maaroof_schedules`. Both nullable / additive. |
| Hybrid MCP as external capabilities (capabilities/policies/auth/scopes/costs/latency/reliability/limits/workspace isolation) | No MCP registry yet | **Add** ONE new table `mcp_providers` (id, name, capabilities jsonb, policies jsonb, auth_kind, scopes text[], avg_cost, avg_latency_ms, reliability, limits jsonb, enabled, workspace_id nullable for isolation, created_at, updated_at). Registered through admin. Selected by the same `pickExpertForCapability` when an MCP outranks a local expert. This is genuinely missing — no duplicate. |

## What is explicitly preserved

- Every existing tool endpoint, orchestrator phase (Envision/Council/Plan/Act/Reflect/Final), SSE event, memory kind, agent factory row, token ledger, cost UI, admin tab, workspace switcher, schedules panel, and RLS policy.
- Existing `Capability` union stays valid; new capabilities from Part 4 (`decision_making`, `summarization`, `validation`, `reflection`, `localization`, `image_analysis`, `document_analysis`, `video_analysis`, `memory_retrieval`, `memory_learning`, `knowledge_refresh`, `automation`, `scheduling`, `reasoning`, `knowledge_graph`) are appended, never renamed.
- With every new setting flag defaulted to today's behavior (`capability_mode=AUTO`, `queue_enabled=false → falls through to direct run`), Part 3 and Part 2 behavior is byte-identical.

## Scope of this change

1. **DB migration (single file, additive only)**
   - `mcp_providers` table + full GRANT + RLS (owner + admin + workspace-member SELECT).
   - `ALTER maaroof_runs ADD COLUMN queue_state text default 'succeeded', priority int default 5, attempts int default 0, next_attempt_at timestamptz, parent_run_id uuid, depends_on_run_id uuid` — all nullable / defaulted so old rows read fine.
   - `ALTER maaroof_schedules ADD COLUMN capabilities jsonb, cost_limit_usd numeric, token_limit int, retry_rules jsonb, approval_rules jsonb, conditions jsonb` — all nullable.
   - `CREATE VIEW capability_scores_v` aggregating from `token_ledger` + `maaroof_runs` + static tool→capability mapping (via `unnest` over a small inline `capability_tool_map` CTE built from the same names we already use).
   - No table drops, no renames, no policy tightening on existing tables.

2. **`src/lib/tool-catalog.ts`** (evolve, not replace)
   - Append the new Part 4 capabilities to the `Capability` union.
   - Add optional `avgQuality?`, `avgLatencyMs?`, `riskLevel?`, `requiredPolicies?: string[]`, `requiredKnowledge?: string[]` fields on `ToolDef`. All optional → existing entries unchanged.
   - Add `getCapabilityMeta(cap)` (aggregates experts, avg cost, models, policies).
   - Upgrade `pickExpertForCapability(cap, opts?)` with an optional `{ mode: "auto"|"preferred"|"forced", preferred?: ToolKey[], scores?: Map<...> }` — old callers pass no opts and behavior is identical.

3. **`src/lib/maaroof/capability.server.ts`** (NEW, small helper — the ONLY new .server file)
   - `loadCapabilityScores()` → reads `capability_scores_v`, cached 60s (mirrors `settings.server.ts` pattern).
   - `buildCapabilityGraph(plan, workspace)` → returns `{ nodes, edges }` structure used by orchestrator, replay UI, and a new `graph` SSE event.
   - `chooseImplementation(cap, ctx)` → wraps `pickExpertForCapability` with score + mode + MCP-provider blending.
   - Why new file: this logic doesn't exist anywhere — it's not duplication, it's the missing composer that Part 4 requires. All heavy lifting still comes from existing modules.

4. **`src/lib/maaroof/orchestrator.server.ts`** (evolve)
   - Before Council, call `buildCapabilityGraph` and emit `graph` SSE event (additive).
   - Replace inline `findExpertsByCapability` call in the council loop with `chooseImplementation` — same result today (AUTO + no scores yet), better once scores populate.
   - After each phase, append a structured entry to `decision_log` with `why` (capability, expert, mcp, model, cost, confidence sub-scores). Field is already jsonb; no schema change.
   - When enqueuing/finishing a run, stamp `queue_state` transitions. Existing SSE consumers see no change.

5. **`src/routes/api/maaroof.ts`** — pass `queue_state` update on cancel and expose `graph` SSE event (already forwards unknown events, so mostly a no-op).

6. **Admin surfaces (evolve, no new routes)**
   - `src/components/admin/MaaroofAdminTab.tsx`: add two sub-tabs alongside existing "الوكلاء":
     - **القدرات (Capabilities)** — reads `capability_scores_v` + `getCapabilityMeta`, shows table of capability × experts × avg cost/quality/latency/success. Buttons: view experts, view MCP providers.
     - **إعادة التشغيل (Decision Replay)** — picks a `maaroof_runs` row, renders `decision_log` timeline. Reuses existing badge/table components.
   - `src/components/admin/MaaroofAdminTab.tsx`: add a small **MCP Providers** manager section (list/enable/disable, edit capabilities/policies/limits) — writes to the new `mcp_providers` table only.
   - `src/components/maaroof/SchedulesPanel.tsx`: expose the new optional fields (cost/token limits, retry, approval, conditions) as collapsed advanced section. Defaults keep old schedules working unchanged.

7. **`src/routes/maaroof.tsx`** — no structural change; the existing SSE handler already renders arbitrary events, so the new `graph` event surfaces as a "خارطة القدرات" step in the live timeline.

8. **`src/lib/maaroof/settings.server.ts`** — add three optional flags (all defaulted to preserve today's behavior): `capability_scoring_enabled`, `mcp_registry_enabled`, `queue_enabled`. Existing `kill_switch`, `council`, `agent_factory` untouched.

## What is out of scope (deferred to Part 5+)

- Real MCP transport / connection execution (Part 4 spec only requires registry + selection).
- Actual pause/resume runtime scheduler daemon (queue columns land now; the async runner comes with Part 5 "Cost Intelligence + Executive Dashboard").
- Any new frontend page — everything lands inside existing admin tabs and the existing `/maaroof` UI.

## Post-implementation audit checklist

- [ ] `TOOL_CATALOG` unchanged in shape for consumers that don't read the new optional fields.
- [ ] Every new column is nullable with a default; SELECTs on `maaroof_runs` / `maaroof_schedules` return the same values as before for old rows.
- [ ] `capability_scores_v` returns zero rows on a fresh install without breaking `chooseImplementation` (fallback path returns today's pick).
- [ ] `agent_factory_enabled=false` + `capability_scoring_enabled=false` + `mcp_registry_enabled=false` + `queue_enabled=false` reproduces Part 3 behavior byte-for-byte.
- [ ] No new page routes, no new server-function module besides `capability.server.ts`, no renamed tables, no renamed SSE events.
- [ ] Admin translations reused (`admin-i18n.ts`) — no duplicate translation keys.
