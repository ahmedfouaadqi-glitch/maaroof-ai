# Phase 9 — Comparative Tests (Baseline vs Enhanced)

## Objective

Demonstrate the effect of the preceding MAAROOF development phases through paired, reproducible before/after tests. This phase does not accept improvements based on implementation presence or a synthetic score.

## Comparison design

- **Baseline:** an immutable snapshot of the pre-enhancement code and its captured outputs.
- **Enhanced:** the candidate branch/version and outputs from the same test cases.
- Pair by stable `caseId` and existing `tool`; only exact matched pairs contribute to deltas.
- Keep test prompts, workspace fixture, geographic scope, language, input files, model/provider configuration and external-data snapshot constant wherever reproducible.
- Record the source/version of every evaluator and the exact code commit for both cohorts.
- Run no paid or live external operations by default. Use saved fixtures and deterministic validators first; live probes require separate approval and budget.

## Dimensions

| Dimension | Measurement rule |
|---|---|
| Output correctness | Ground truth, human rubric review, or named deterministic validator |
| Analysis quality | Tool-specific Phase 8 rubric, with validated observations |
| Evidence reliability | Claim/source checks and source authority review; URL count is not reliability |
| Reasoning validity | Explicit rubric/ground truth for assumptions, dependency order and conclusions |
| Tokens | Observed token counts from paired runs |
| Cost | Observed cost ledger values for paired runs; missing cost stays unknown |
| Latency | Measured wall-clock duration under documented environment |
| Integration success | Expected-versus-observed result for the same integration fixture |
| Regression | Compare existing tool coverage, output contracts, permission/isolation and failure behavior |

## Implementation in this batch

- Add a pure paired-cohort comparison module.
- Reject duplicate case/tool keys from analysis and report them.
- Keep unmatched cases visible but exclude them from paired deltas.
- Calculate per-dimension means and deltas only where both sides have valid observations.
- Require quality observations to name a source: `ground_truth`, `human_review` or `automated_validator`, plus a validator/rubric identifier.
- Apply explicit regression/cost/latency tolerances; never collapse dimensions into a composite score.
- Integration regressions block acceptance.
- No model call, database migration, provider, external API, new tool or engine is added.

## Acceptance gates

A candidate is only **eligible for human review** when:
1. There are matched baseline/enhanced cases.
2. All three core quality dimensions have paired validated observations.
3. No quality dimension regresses beyond the configured tolerance.
4. No previously successful integration becomes unsuccessful.
5. Cost and latency increases remain within documented tolerances, where measured.
6. Unmatched cases, missing data and duplicate keys are disclosed.
7. Existing catalogue, ten-engine configuration, GEO, MCI/memory, workspace isolation and approval gates remain intact.

Eligibility is not approval. Human review must assess sample adequacy, validator validity, representative task mix, and material regressions. Statistical significance requires a separately designed sample-size/power protocol; this batch makes no significance claim.

## Baseline integrity and limitations

- Do not label current candidate outputs as baseline.
- Do not synthesize baseline results from memory, expected outputs or current code.
- Baseline fixtures must be captured from an identified immutable commit.
- Keep model-estimated scores separate from ground-truth/human/validator assessments.
- A GEO rubric score is not observed ranking or AI-engine visibility.
- Tool success is not output correctness; reference URL count is not source reliability.
- No actual before/after improvement is claimed until real paired cohorts are populated and reviewed.

## Current batch status

This batch supplies the comparison engine and unit tests only. It does not yet contain a production baseline dataset, captured paired runs, blind human-review set, or statistical power analysis. Therefore Phase 9 is **in progress**, not complete.
