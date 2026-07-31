## What already exists (evaluated first, per the constitution)

Verified by reading the code before planning:

- `src/lib/maaroof/trust.server.ts` — 13-stage trust pipeline, `trust_profiles`, `trust_events`, `executiveDecisionScore`, `findWeakLinks`.
- `src/lib/maaroof/knowledge.server.ts` — 9-layer knowledge graph with `confidence`, `reliability`, `freshness_at`, `quality`, `sources`, plus decay.
- `src/lib/maaroof/decisions.server.ts` — 20-stage `DecisionTracer` writing `decision_traces`.
- `src/lib/maaroof/laws.server.ts` — 30 laws, `evaluateLaws`, hard-law blocking already wired into the orchestrator.
- `src/lib/maaroof/orchestrator.server.ts` (1296 lines) — envision → plan → capability → council → execution → trust → evidence graph → laws, with `maaroof_runs.trust` and `decision_log` persisted.
- `state.server.ts` (anchors/drift), `experts.server.ts`, `hermes.server.ts` (proposals + reporting).

**Why evolve, not create:** evidence, confidence and verification signals are already produced by four separate engines but are never *classified*, *scored as one reality state*, or *fed back* into knowledge/trust as verified fact. Part 19 needs exactly that missing seam — so this adds one thin layer that reads the existing signals rather than a parallel stack. Nothing is removed or rewritten.

## What Part 19.1 adds

### 1. Reality classification module — `src/lib/maaroof/reality.server.ts` (new, thin)
- `REALITY_STATES`: verified, measured, observed, predicted, experimental, opinion, hypothesis, simulation, historical, external, internal, unknown.
- `classifyReality(signals)` — derives the state from signals the run already emits (tool results ok/fail, memories recalled, knowledge nodes used, trust pipeline output, execution mode, council confidence). Zero extra model calls.
- `realityScore(...)` returning `{ reality_score, evidence_score, verification_score, confidence, missing_evidence[], contradictions[], reproducible }`.
- `REALITY_LOOP` stage list (Observation → … → Continuous Improvement) exported so every engine can stamp its loop stage.
- `realityPromptBlock()` — appends the transparency rules to the existing system prompt (flag-gated like `lawsPromptBlock`).

### 2. Evidence + reality persistence (one migration)
- `reality_records`: run_id, user_id, workspace_id, subject (tool/answer/publication/proposal), reality_state, reality/evidence/verification scores, confidence, loop_stage, missing_evidence jsonb, contradictions jsonb, created_at.
- `evidence_items`: reality_record_id, source_kind (tool_result | memory | knowledge_node | measurement | external | execution), source_ref, claim, verified_at, verified_by, success_count, contradicts jsonb, reproducible bool.
- Both with GRANTs (`authenticated` select of own rows, `service_role` all), RLS enabled, owner-scoped policies, and indexes on (user_id, created_at) and (run_id).

### 3. Orchestrator integration (edit, not rewrite)
- After the existing trust/evidence-graph block and before the laws gate: build reality signals from the already-collected `results`, `memories`, `decisionLog`, `trust`, `timing`, persist a `reality_records` row + `evidence_items`, emit a `reality` event, and store it on `maaroof_runs`.
- Feed the result back: verified/measured outcomes bump `confidence`/`reliability` on the knowledge nodes used (via existing `upsertKnowledgeNode`) and record a `trust_event` — closing the Reality Loop with the engines that already exist.
- Transparency: when reality_state is weaker than `measured`, prepend the existing-style notice (same pattern as `hardLawNotice`) declaring confidence, missing evidence and alternatives.
- Settings flag `reality_engine.enabled` added to `settings.server.ts` defaults so the layer is opt-in and backward compatible.

### 4. Hermes oversight (extend existing)
- Add reality checks to `hermes.server.ts` signal gathering: verification gaps, low reality scores, contradictions, stale evidence — surfaced as existing-format proposals/report lines. No new Hermes stack.

### 5. Admin UI (extend existing)
- New `RealityCenter` panel registered inside `MaaroofIntelligenceCenter.tsx` alongside the current centers: distribution of reality states, verification-gap list, weakest evidence, loop-stage funnel. Strings go through `src/lib/i18n/{ar,en,ku}.ts` (no hardcoded text).

### 6. Documentation
- `docs/PART19-REALITY.md`: what existed, what was evaluated, why evolution was chosen over creation, and the mapping of each constitutional principle to the pre-existing component that already satisfies it.

## Technical notes
- No table, function, route or component is deleted or renamed; all Parts 1–18 behaviour is preserved and every new path is flag-gated off by default until enabled in settings.
- Reality classification is fully local/heuristic — no additional token cost.
- Server-only code stays in `*.server.ts`; UI reaches it through existing `createServerFn` wrappers in `src/lib/cognition.functions.ts` style.
