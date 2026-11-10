# Phase 8 — Evaluation & Quality Development

## Objective

Evaluate existing MAAROOF tools using criteria appropriate to each tool. Separate measurable execution facts from subjective/model-estimated assessments and historical performance proven by real usage data.

## Tool-specific criteria

- \`suggest\`: GEO readiness, audience/psychological relevance, content quality, factual accuracy.
- \`research\`: source reliability, coverage, freshness, claim-to-source support.
- \`compare\`: comparison fairness, evidence completeness, conclusion validity.
- \`feasibility\`: assumption validity, calculation accuracy, risk coverage.
- \`visibility\`: measurement validity, engine/query coverage, citation readiness, observed GEO signals.
- \`social_analysis\`: evidence quality, audience understanding, inference validity.
- Other existing tools use a bounded rubric or a generic task-specific rubric.

## Measurement separation

1. **Observed execution facts:** tool success/failure, output presence, reference URL count, and run-level token/cost values when available. These describe the current run only.
2. **Model-estimated quality:** a separate field. It remains null/not evaluated in this batch; no model call is added.
3. **Historical performance:** requires workspace-scoped samples, adequate sample size, outcome labels/ground truth and a defined measurement window. It is not inferred from a single run.

## Guardrails

- Tool success is not factual correctness.
- A URL count is not source reliability.
- GEO rubric readiness is not observed ranking or AI-engine visibility.
- No synthetic or hardcoded quality percentages.
- No aggregate quality score when domain-specific criteria are not measurable.
- No automatic model/tool/prompt promotion or production configuration changes.
- Preserve existing engines, tools, integrations, GEO, MCI, workspace isolation and approval gates.

## Batch 1 implementation

- Add a pure, deterministic evaluation module.
- Register per-tool criteria for key existing tools.
- Emit measured run facts separately from unmeasured domain criteria.
- Attach the evaluation report to the existing assistant run message and emit an evaluation event.
- No database migration, external API, paid call or additional model invocation.

## Acceptance

- Tests prove measured execution facts are distinct from estimated/historical quality.
- Tests prevent URL counts from being interpreted as reliability.
- Tests prevent GEO rubric criteria from being represented as observed ranking.
- Existing tools and the ten-engine catalogue remain unchanged.
- CI tests and production build pass.
- Before/after and historical performance comparisons remain for subsequent validation work; this batch does not claim Phase 8 complete.
