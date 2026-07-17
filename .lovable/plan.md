# Part 3 — Agent Factory (Evolution, Not Replacement)

## Constitution self-review (why evolve, not build new)

Before touching any file I mapped every requirement in Part 3 to what already exists:

| Part 3 requirement | Existing implementation | Decision |
|---|---|---|
| Agent identity, DNA, role | `maaroof_runs` (goal, plan, decision_log, workspace), `workspaces.preferred_experts/models/mcp`, `tool_catalog` DNA | **Evolve** — add DNA columns to a new lightweight `maaroof_agents` registry that references, not replaces, runs/workspaces |
| Sub-agent creation & lifecycle | `agent_tasks` + `user_agent_subscriptions` already model background agent runs; orchestrator has Plan/Council/Act/Reflect | **Evolve** — add `parent_agent_id`, `lifecycle_state`, `confidence` columns to reuse the existing table instead of creating `sub_agents` |
| Expert Council & negotiation | Already implemented in `orchestrator.server.ts` (council phase, decision_log, `findExpertsByCapability`) | **Extend** — add objection/negotiation rounds inside the same phase; no new module |
| Warm agents / Standby / Wake-up | Missing | **Add** — new lifecycle state values + reactivation path on the same `maaroof_agents` row |
| Versioning (v1→v2…) | Missing | **Add** — `version int` + `parent_version_id` on `maaroof_agents`; no separate history table (audit is `maaroof_runs` + `decision_log`) |
| Confidence & Cost breakdowns | `maaroof_runs.total_tokens/total_usd`, `token_ledger` per tool | **Extend** — add `cost_breakdown jsonb` + `confidence jsonb` computed at run end, surfaced in existing Admin Finance / Maaroof panels |
| Multi-language personality | `i18n` + system prompt already handles ar/en/ku | **Preserve** — inject agent role into existing `buildSystemPrompt` |
| Human interaction from sub-agent | Missing UI | **Add** — a `needs_human` event on the existing SSE stream in `/api/maaroof` |

No table, service, API, or component is being renamed, replaced, or duplicated. Every new field lives on an existing table or on one **new** table (`maaroof_agents`) that is the single missing piece.

## Scope

1. **DB migration** — one new table `maaroof_agents` (the Agent Registry / DNA), and additive columns on `agent_tasks` (`parent_agent_id`, `lifecycle_state`, `confidence`, `agent_id`). Full GRANTs + RLS scoped to `auth.uid()` via workspace membership. No drops, no renames.
2. **`src/lib/maaroof/agents.server.ts`** (new, small) — pure helpers: `getOrCreateAgent(workspaceId, role, dna)`, `updateLifecycle(agentId, state)`, `bumpVersion(agentId, changes)`, `pickWarmAgent(workspaceId, capability)`. Uses `supabaseAdmin`, imported inside handlers.
3. **`src/lib/maaroof/orchestrator.server.ts`** (evolve) —
   - Before the existing Envision phase: call `pickWarmAgent` → reuse standby agent when success≥threshold, else `getOrCreateAgent` with DNA derived from capabilities the plan needs. Emit new `agent` SSE event.
   - Council phase (already exists): add an optional **negotiation round** — each expert may issue an `objection` (already in schema) and Maaroof either revises the plan or records rationale. Bounded by existing `max_experts`.
   - After the run: compute `confidence` (avg council confidence + tool success rate) and `cost_breakdown` (planning/execution/reflection tokens already tracked) → write to `maaroof_agents` and `maaroof_runs.decision_log`. Move agent to `standby` if success, else `archived`.
   - `buildSystemPrompt`: inject the picked agent's Role + Mission (multi-language safe).
4. **`src/routes/api/maaroof.ts`** — surface a `needs_human` SSE event when any council step returns `confidence < settings.min_confidence`; frontend already renders arbitrary events.
5. **`src/components/admin/MaaroofAdminTab.tsx`** (evolve) — new sub-panel "Agent Registry": list `maaroof_agents` with role, lifecycle, version, success rate, cost breakdown, wake/archive buttons. Reuses existing table/badge components.
6. **`src/routes/maaroof.tsx`** (evolve) — add a compact "Active Agent" chip next to the existing Workspace switcher showing role + confidence when a run is live. No route split, no new page.
7. **`src/lib/tool-catalog.ts`** — add `min_confidence` per capability (data only, no logic change) so the negotiation round has a threshold. Backward compatible (optional field).
8. **Settings** (`maaroof_settings`) — add three optional flags (default preserves current behavior): `agent_factory_enabled`, `warm_reuse_enabled`, `min_confidence`. Existing kill_switch still wins.

## What is explicitly preserved

- All 16 tool endpoints — untouched.
- Existing `agent_tasks`, `user_agent_subscriptions`, `agent_addons`, trial flow, token_ledger, charge_tokens RPC — untouched, only additive columns on `agent_tasks`.
- Existing Envision / Council / Act / Reflect / Final phases — reordered only to slot agent selection before Envision.
- Existing SSE event names — only additions (`agent`, `needs_human`), no renames.
- Existing memory kinds — reuse `decision`, `preference`, `summary`; no new kinds.
- Existing Admin tabs — Finance, System Health, Cognitive Insights untouched; new panel is a sub-section inside the existing `MaaroofAdminTab`.

## Technical details

**`maaroof_agents` columns**: `id`, `workspace_id (fk)`, `user_id (fk)`, `parent_agent_id (self fk, null)`, `role text`, `mission text`, `dna jsonb` (capabilities, preferred_experts, preferred_models, decision_style, thinking_style), `version int default 1`, `lifecycle_state text check in ('created','initialized','learning','planning','executing','reflecting','optimizing','standby','reactivated','merged','archived','deleted') default 'created'`, `success_rate numeric`, `runs_count int`, `confidence jsonb`, `cost_breakdown jsonb`, `last_run_id fk`, `created_at`, `updated_at`.

**RLS**: owner (`user_id = auth.uid()`) full access; workspace members SELECT via existing `workspace_members`; admin SELECT via `has_role`. GRANTs to `authenticated` + `service_role`.

**No breaking changes**: every new column is nullable / has a default; every new SSE event is additive; every new setting flag defaults to preserving today's behavior.

## Out of scope (deferred to later Parts)

Capability Engine, Hybrid MCP switching, Queue, Scheduler executive layer, Executive Dashboard, Cost Intelligence — Part 3 file explicitly lists these as "NEXT". This plan only lands the Agent Factory primitives they will build on.

## Post-implementation audit checklist

- No file renamed or deleted.
- No duplicate table/service/API/component created (only `maaroof_agents` + `agents.server.ts`, both genuinely missing).
- All existing tests / routes / SSE consumers still work (events are additive).
- Backward compatibility: with `agent_factory_enabled=false` the orchestrator behaves exactly as today.
