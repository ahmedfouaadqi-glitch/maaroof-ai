# Phase 7 — Execution & Integration Development

## Objective

Improve execution and integration across the existing MAAROOF capabilities without adding engines, tools, providers, paid APIs, or a parallel memory/evidence store.

## Batch 1 — Bounded execution evidence pack

- Build a deterministic evidence pack from successful outputs already produced in the current run.
- Preserve failed/skipped steps separately as execution limitations.
- Remove exact duplicate tool outputs before placing them in the final-answer prompt.
- Bound prompt size and per-result payload size.
- Explicitly label outputs as tool-returned evidence, not independently verified external facts.
- Retain complete outputs in the existing run record; the pack is only a bounded prompt representation.
- No additional model invocation or external request.

## Existing systems retained

- Existing ten-engine catalogue and tool catalogue.
- Existing orchestrator, scheduler, direct dispatch, MCI, memory, knowledge, evidence, Reality, Trust, cost ledger, timeout and approval mechanisms.
- Existing workspace-scoped persistence and memory paths.

## Safety and cost

- No automatic tool retries are introduced in this batch.
- No paid service/API or new provider is introduced.
- No tool result is upgraded to a verified external fact solely because the tool succeeded.
- Duplicate suppression is exact-payload deduplication only; semantically similar but non-identical outputs are retained.
- No database migration or schema change.

## Validation

- Unit tests cover evidence labeling, exact deduplication, failed-step separation, output bounds and empty runs.
- Full CI must pass on the phase branch.
- This is the first implementation batch, not completion of Phase 7.

## Follow-up batches

1. Workspace-scoped context retrieval audit, including history and MCI planning hints.
2. Error taxonomy and retry eligibility using existing timeouts/abort/cost gates; no retry after uncertain side effects.
3. Context/token budget policy across planner, reflection and final synthesis.
4. Before/after regression cases for sequential and dependency-aware parallel execution.
5. Evidence provenance and contradiction checks against existing Evidence/Reality records.
