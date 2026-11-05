/**
 * Phase 8 — Evaluation & Quality Development.
 * Pure functions only: no database, network, model call, or side effect.
 */
export type QualityToolResult = { tool: string; ok: boolean; output?: unknown };
export type QualityCriterion = { id: string; label: string; evidenceNeeded: string };
export type CriterionAssessment = QualityCriterion & {
  status: "not_measured";
  value: null;
  reason: string;
};

export const TOOL_QUALITY_RUBRICS: Record<string, QualityCriterion[]> = {
  suggest: [
    { id: "geo_readiness", label: "GEO readiness", evidenceNeeded: "A defined GEO/content rubric and validated content checks" },
    { id: "audience_relevance", label: "Audience and psychological relevance", evidenceNeeded: "Declared audience, intent and validated relevance criteria" },
    { id: "content_quality", label: "Content quality", evidenceNeeded: "A content rubric with observable checks or human review" },
    { id: "factual_accuracy", label: "Factual accuracy", evidenceNeeded: "Claim-level source verification or ground truth" },
  ],
  research: [
    { id: "source_reliability", label: "Source reliability", evidenceNeeded: "Source identity, authority and reliability assessments" },
    { id: "coverage", label: "Research coverage", evidenceNeeded: "A defined scope checklist and coverage validation" },
    { id: "freshness", label: "Source freshness", evidenceNeeded: "Source publication or retrieval timestamps" },
    { id: "claim_support", label: "Claim-to-source support", evidenceNeeded: "Claim-level citation mapping" },
  ],
  compare: [
    { id: "comparison_fairness", label: "Comparison fairness", evidenceNeeded: "Equivalent criteria and comparable input coverage" },
    { id: "evidence_completeness", label: "Evidence completeness", evidenceNeeded: "A defined evidence checklist for all compared entities" },
    { id: "conclusion_validity", label: "Conclusion validity", evidenceNeeded: "Validated inference rules and supporting evidence" },
  ],
  feasibility: [
    { id: "assumption_validity", label: "Assumption validity", evidenceNeeded: "Explicit assumptions with traceable source or owner confirmation" },
    { id: "calculation_accuracy", label: "Calculation accuracy", evidenceNeeded: "Reproducible calculations and checked input values" },
    { id: "risk_coverage", label: "Risk coverage", evidenceNeeded: "A defined risk taxonomy and completeness check" },
  ],
  visibility: [
    { id: "measurement_validity", label: "Measurement validity", evidenceNeeded: "Raw observations, query scope and reproducible measurement method" },
    { id: "engine_coverage", label: "Engine and query coverage", evidenceNeeded: "Expected-versus-observed engine/query matrix" },
    { id: "citation_readiness", label: "Citation readiness", evidenceNeeded: "Captured citations with URL and source metadata" },
    { id: "geo_observation", label: "GEO observation", evidenceNeeded: "Observed engine responses; never infer ranking from a rubric score" },
  ],
  social_analysis: [
    { id: "evidence_quality", label: "Evidence quality", evidenceNeeded: "Traceable public posts, source metadata and sampling method" },
    { id: "audience_understanding", label: "Audience understanding", evidenceNeeded: "Observed audience data or explicitly labelled hypotheses" },
    { id: "inference_validity", label: "Inference validity", evidenceNeeded: "Evidence-backed inference checks and uncertainty handling" },
  ],
  analyze: [
    { id: "analysis_accuracy", label: "Analysis accuracy", evidenceNeeded: "Validated findings and independently checked facts" },
    { id: "evidence_strength", label: "Evidence strength", evidenceNeeded: "Claim-level evidence and source reliability" },
    { id: "geo_integrity", label: "GEO integrity", evidenceNeeded: "Observed GEO signals and a versioned rubric" },
  ],
  known: [
    { id: "entity_resolution", label: "Entity resolution", evidenceNeeded: "Resolved entity identifiers and disambiguating sources" },
    { id: "competitor_evidence", label: "Competitor evidence", evidenceNeeded: "Traceable evidence for each competitor relationship" },
    { id: "market_coverage", label: "Market coverage", evidenceNeeded: "Defined market scope and coverage matrix" },
  ],
  brand_authority: [
    { id: "authority_evidence", label: "Authority evidence", evidenceNeeded: "Traceable authority signals and independent sources" },
    { id: "factual_accuracy", label: "Factual accuracy", evidenceNeeded: "Claim-level source verification" },
    { id: "geo_alignment", label: "GEO alignment", evidenceNeeded: "Versioned GEO checks and observed engine data" },
  ],
  keyword_intelligence: [
    { id: "keyword_relevance", label: "Keyword relevance", evidenceNeeded: "Search intent and market-specific validation" },
    { id: "volume_accuracy", label: "Volume and CPC accuracy", evidenceNeeded: "Named data provider, market, date and methodology" },
    { id: "competitor_coverage", label: "Competitor coverage", evidenceNeeded: "Documented competitor and source coverage" },
  ],
  what_if: [
    { id: "assumption_transparency", label: "Assumption transparency", evidenceNeeded: "Explicit scenario assumptions and input provenance" },
    { id: "calculation_reproducibility", label: "Calculation reproducibility", evidenceNeeded: "Reproducible formulas and scenario inputs" },
    { id: "sensitivity_coverage", label: "Sensitivity coverage", evidenceNeeded: "Defined sensitivity variables and scenario comparisons" },
  ],
  translate: [
    { id: "meaning_preservation", label: "Meaning preservation", evidenceNeeded: "Source-target semantic comparison or human review" },
    { id: "terminology_consistency", label: "Terminology consistency", evidenceNeeded: "Approved glossary and terminology checks" },
    { id: "locale_fit", label: "Locale fit", evidenceNeeded: "Locale-specific linguistic review" },
  ],
  bizdev: [
    { id: "opportunity_evidence", label: "Opportunity evidence", evidenceNeeded: "Traceable market and partner evidence" },
    { id: "strategic_fit", label: "Strategic fit", evidenceNeeded: "Declared business goals and fit criteria" },
    { id: "actionability", label: "Actionability", evidenceNeeded: "Owners, prerequisites, costs and measurable next steps" },
  ],
  brand_boost: [
    { id: "brand_consistency", label: "Brand consistency", evidenceNeeded: "Approved brand identity and content constraints" },
    { id: "evidence_traceability", label: "Evidence traceability", evidenceNeeded: "Traceable sources for claims and observed outcomes" },
    { id: "execution_readiness", label: "Execution readiness", evidenceNeeded: "Validated deliverables, permissions and approval status" },
  ],
  company_email: [
    { id: "recipient_relevance", label: "Recipient relevance", evidenceNeeded: "Verified recipient role and company context" },
    { id: "claim_accuracy", label: "Claim accuracy", evidenceNeeded: "Verified facts and claims about sender and recipient" },
    { id: "message_quality", label: "Message quality", evidenceNeeded: "Message rubric and human review" },
  ],
  applied_ranking: [
    { id: "priority_validity", label: "Priority validity", evidenceNeeded: "Impact/effort inputs and explicit prioritisation method" },
    { id: "recommendation_traceability", label: "Recommendation traceability", evidenceNeeded: "Links from recommendations to validated findings" },
    { id: "expected_impact", label: "Expected impact", evidenceNeeded: "Measured baseline and post-change outcomes" },
  ],
  geo_strategist: [
    { id: "strategy_evidence", label: "Strategy evidence", evidenceNeeded: "Current observations and cited market evidence" },
    { id: "roadmap_feasibility", label: "Roadmap feasibility", evidenceNeeded: "Owners, resources, dependencies and timeline" },
    { id: "geo_alignment", label: "GEO alignment", evidenceNeeded: "Versioned GEO criteria and observed engine evidence" },
  ],
  competitor_monitor: [
    { id: "change_detection", label: "Change detection", evidenceNeeded: "Timestamped before/after source snapshots" },
    { id: "alert_precision", label: "Alert precision", evidenceNeeded: "Reviewed true-positive and false-positive alert labels" },
    { id: "coverage", label: "Monitoring coverage", evidenceNeeded: "Declared watchlist and successful observation log" },
  ],
  geo_rewrite: [
    { id: "meaning_preservation", label: "Meaning preservation", evidenceNeeded: "Source-to-rewrite claim and meaning comparison" },
    { id: "geo_structure", label: "GEO structure", evidenceNeeded: "Versioned content structure checks" },
    { id: "factual_integrity", label: "Factual integrity", evidenceNeeded: "Claim-level verification against source content" },
  ],
};

const DEFAULT_RUBRIC: QualityCriterion[] = [
  { id: "output_correctness", label: "Output correctness", evidenceNeeded: "Task-specific ground truth or validated expected result" },
  { id: "evidence_support", label: "Evidence support", evidenceNeeded: "Traceable claim-level evidence" },
  { id: "scope_completeness", label: "Scope completeness", evidenceNeeded: "A task-specific acceptance checklist" },
];

function hasUsableOutput(output: unknown): boolean {
  if (output == null) return false;
  if (typeof output === "string") return output.trim().length > 0;
  if (Array.isArray(output)) return output.length > 0;
  if (typeof output === "object") return Object.keys(output as Record<string, unknown>).length > 0;
  return true;
}

function collectUrls(value: unknown, found = new Set<string>(), depth = 0): Set<string> {
  if (depth > 6 || value == null) return found;
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/g)) found.add(match[0].replace(/[.,;)}\]]+$/, ""));
  } else if (Array.isArray(value)) {
    for (const item of value.slice(0, 200)) collectUrls(item, found, depth + 1);
  } else if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>).slice(0, 200)) collectUrls(item, found, depth + 1);
  }
  return found;
}

/**
 * Produces observable run facts plus an explicit unmeasured domain rubric.
 * The observed success rate describes this run only, not correctness or history.
 */
export function evaluateRunQuality(
  goal: string,
  results: QualityToolResult[],
  usage: { tokens?: number; costUsd?: number } = {},
) {
  const successCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - successCount;
  const toolEvaluations = results.map((item, index) => {
    const urls = [...collectUrls(item.output)];
    const rubric = TOOL_QUALITY_RUBRICS[item.tool] || DEFAULT_RUBRIC;
    const criteria: CriterionAssessment[] = rubric.map((criterion) => ({
      ...criterion,
      status: "not_measured",
      value: null,
      reason: "No validated domain-specific evaluator or ground truth is connected in this phase.",
    }));
    return {
      index,
      tool: item.tool,
      execution: item.ok ? "succeeded" : "failed",
      outputPresent: hasUsableOutput(item.output),
      referenceUrlCount: urls.length,
      referenceUrls: urls.slice(0, 30),
      criteria,
    };
  });
  const tokens = Number.isFinite(usage.tokens) && Number(usage.tokens) >= 0 ? Number(usage.tokens) : null;
  const costUsd = Number.isFinite(usage.costUsd) && Number(usage.costUsd) >= 0 ? Number(usage.costUsd) : null;

  return {
    schemaVersion: "phase8-quality-v1",
    goal: String(goal || "").slice(0, 500),
    evaluationType: "observed_run_facts_plus_unmeasured_domain_rubrics",
    observedExecution: {
      sampleSize: results.length,
      successfulTools: successCount,
      failedTools: failedCount,
      toolExecutionSuccessRate: results.length ? Number((successCount / results.length).toFixed(4)) : null,
      tokens,
      costUsd,
      scope: "This single run only; not a historical or statistical performance estimate.",
    },
    modelEstimatedQuality: {
      status: "not_evaluated",
      score: null,
      reason: "No model-generated quality score is produced by this phase-8 batch.",
    },
    historicalPerformance: {
      status: "not_measured",
      sampleSize: null,
      reason: "Requires a sufficiently sized, workspace-scoped historical dataset and defined ground truth.",
    },
    toolEvaluations,
    guardrails: [
      "Tool execution success is not proof of factual correctness.",
      "Reference URL count is not a source reliability score.",
      "GEO rubric readiness is not observed search ranking or engine visibility.",
      "No aggregate quality score is emitted when domain criteria are unmeasured.",
      "No automatic model, tool, prompt or production configuration promotion is permitted.",
    ],
  };
}
