## Part 7 — Executive Intelligence Constitution (Evolution, not rebuild)

### What already exists (verified by reading the code)
- `maaroof_agents.dna` already carries `decision_style`, `thinking_style`, `communication_style`, `cost_profile`, `learning_profile` (`src/lib/maaroof/agents.server.ts`) → Personality Engine evolves this column, no new table.
- Expert Council with per-capability opinions, objections, confidence, and a final `decision` entry written to `maaroof_runs.decision_log` (`orchestrator.server.ts` ~lines 247–345) → Conflict Engine extends this, no second council.
- `quality_score` (11 heuristic dims) already written to `maaroof_runs` behind `platform_evolution.quality_score_enabled` → Executive Quality Index aggregates these, no new scoring pass.
- `platform_dna` + `maaroof_evolution_reports` + `cognition.server.ts` → Future DNA and Self-Evolution reuse both.
- `workspaces` already has `profile`, `policies`, `goals`, `success_metrics`, `preferred_models/experts/mcp`, `risk_level`, `budget` → Digital Genome is a read/write view over these, not a new table.
- `capability_scores_v`, `expert_scores_v`, `model_scores_v`, `mcp_scores_v`, memory graph, whatif scenarios → these are the Evidence Graph sources.

Everything below is additive and flag-gated under a new `executive` settings group (all default OFF except where noted), so current behaviour is byte-for-byte preserved when disabled.

### 1. Database (single additive migration, no drops)
- `maaroof_agents`: add `personality jsonb default '{}'` (10 executive traits) and `personality_version int default 1`.
- `maaroof_runs`: add `timing jsonb` (Strategic Time verdict) and `trust jsonb` (Trust Engine envelope).
- `platform_dna`: reuse as-is; new rows use `kind='future_dna'`.
- New view `executive_quality_index_v`: aggregates `maaroof_runs.quality_score` dims + cost + success into 10 EQI axes, `security_invoker = on`.
- No table is renamed or removed; GRANTs mirror existing sibling tables.

### 2. Executive Personality Engine (`agents.server.ts`)
- Add `evolvePersonality()`: after `finalizeAgent`, nudge the 10 traits (leadership, thinking, decision, communication, risk, innovation, learning, negotiation, planning, reflection) based on observed run signals (success ratio, cost, council confidence, objections raised).
- Traits are bounded and versioned; identity fields (`role`, `mission`) never change. Existing `dna` keys are preserved and read first for backward compatibility.
- Personality is injected into `buildSystemPrompt` so the agent's tone/decision posture reflects it.

### 3. Cognitive Conflict Engine (inside existing council block)
- Detect conflict when council entries disagree (objection present, or confidence spread > threshold, or `suggest_tools` diverge).
- Only then run one extra deliberation pass that scores each position on evidence, confidence, quality, cost, risk, knowledge — explicitly **no voting** — and writes `{ phase: "conflict", positions, weights, chosen, why }` into the same `decision_log`, emitted as a `conflict` SSE event.
- When no conflict exists, zero extra LLM calls (cost neutral).

### 4. Strategic Time Engine
- New `src/lib/maaroof/timing.server.ts`: `assessTiming()` returns `execute_now | delay | schedule | observe | cancel` plus reason, derived from workspace budget/risk policies, cost limits, and missing-data signals from the plan.
- Runs after the council, before execution. `execute_now` → unchanged path. `schedule` → creates a `maaroof_schedules` row (existing table) instead of executing. `delay/observe/cancel` → run ends with status `done` and the verdict surfaced, no tool spend.
- Emitted as a `timing` SSE event and rendered as a chip on `/maaroof`.

### 5. Trust Engine + Evidence Graph
- Extend the existing final-answer call (no new call) to also return a structured envelope: confidence, evidence, sources, reasoning, assumptions, limitations, alternatives, risks, expected outcome.
- Evidence references are drawn from what the run already collected: recalled memories, capability choices, council entries, tool outputs, envision output — assembled by a small `buildEvidenceGraph()` helper in `capability.server.ts` (extends existing `buildCapabilityGraph`).
- Stored in `maaroof_runs.trust`, emitted as `trust`, and rendered as a collapsible "لماذا هذه التوصية" panel under the final answer in `src/routes/maaroof.tsx`.

### 6. Executive Digital Genome
- New `src/lib/maaroof/genome.server.ts` exposing `readGenome(scope)` / `mergeGenome(scope, patch)` over the **existing** columns: workspace (`workspaces.profile/goals/policies/…`), agent (`maaroof_agents.dna/personality`), expert (`tool-catalog` DNA), plus memory/history counts.
- Genome evolves additively; identity/vision/values fields are write-protected once set unless the admin overrides.

### 7. Future DNA
- In the existing `recordDna` path, also emit `kind='future_dna'` rows for both successful and failed runs (outcome, plan shape, timing verdict, quality dims — anonymized, no user text).
- `envision()` and the What-If simulator read recent `future_dna` aggregates as priors.

### 8. Admin surfaces (inside `MaaroofIntelligenceCenter.tsx`, no new admin tab)
- **Executive Quality Index** panel: 10 axes from `executive_quality_index_v` with trend.
- **Personality** panel: per-agent trait radar + version history.
- **Self-Evolution** panel: periodic proposals (improvements, simplification, duplicate removal, cost cuts) generated by extending `cognition.server.ts` reports — **proposals only, never auto-applied**, each with approve/dismiss stored in `app_settings`.
- All new toggles added to the existing Maaroof settings panel.

### 9. Audit
- Append a Part 7 section to `docs/MAAROOF-AUDIT.md`: per-file existing/new/integrated/compat/risks, and the justification for evolving each module rather than creating a new one.

### Technical notes
- No existing table, view, policy, route, component, or settings key is removed or renamed.
- Every new phase is guarded by `settings.executive.*`; with the group off the orchestrator runs the exact Part 6 path.
- Added LLM cost is bounded: at most one extra call for conflict (only on conflict) and zero extra calls for timing, trust (folded into the existing final call), genome, and EQI.
