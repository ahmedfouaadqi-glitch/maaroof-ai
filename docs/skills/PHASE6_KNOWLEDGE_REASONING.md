# Phase 6 — Knowledge & Reasoning Enhancement

## Objective

Improve the existing MAAROOF request-to-result reasoning path without adding an LLM, engine, low-level tool, database table, provider, or external side effect.

## Implemented in this batch

1. Deterministic, low-cost intent signals across Arabic/English requests:
   - brand visibility / SEO / GEO;
   - content creation;
   - research;
   - competitive intelligence;
   - business strategy;
   - social analysis;
   - translation;
   - marketing strategy;
   - general requests.
2. Risk and evidence hints, including detection of explicit external-action language.
3. Planner guidance that is appended to the existing planning request. No additional model call is introduced.
4. A plan validator that only permits tools present in the actual tool catalogue, rejects the paused `competitor_monitor`, limits the number of steps, and retains only dependencies pointing to earlier valid steps.
5. Coverage diagnostics. Missing domain coverage is surfaced as a warning; the validator does not invent additional tool calls or silently increase cost.
6. Unit tests for multilingual intent signals, risk/action hints, invalid tools, dependency order, coverage warnings and step limits.

## Existing systems reused

- Existing orchestrator and planning model call.
- Existing tool catalogue and capability metadata.
- Existing clarification/input-fill helpers.
- Existing MCI, memory, knowledge, evidence, Reality and Trust services.
- Existing cost ledger, timeouts, kill switches and approval gates.

The new classifier is deterministic guidance, not a replacement for model reasoning or a claim of semantic certainty. Existing memory and MCI continue to provide retrieved context; no second memory store is introduced.

## Safety and compatibility

- No changes to the 10-engine catalogue or the existing tool catalogue.
- No external 69-skill package is activated or injected; Phase 5 content vendoring and compatibility reconciliation remain prerequisites for that.
- No new model/API call, DB migration, paid provider call, script execution, external publishing or outreach.
- User-selected tools remain authoritative, except unknown/paused tool IDs are not admitted.
- Missing coverage is observable and does not trigger an automatic expensive fallback.

## Acceptance

- Existing tool IDs only; no dangling tool references.
- Dependencies must reference an earlier valid step.
- Planner context overhead is bounded and adds no model invocation.
- Unit tests cover deterministic classification and plan sanitation.
- Full CI (existing unit tests and production build) must pass before considering the batch verified.

## Status

This is the first implementation batch of Phase 6. It does not claim the entire knowledge/reasoning phase is complete: output-quality reflection, evidence completeness checks and comparative regression evaluation remain follow-up batches.
