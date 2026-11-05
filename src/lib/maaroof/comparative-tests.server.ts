/**
 * Phase 9 — paired baseline/enhanced comparative evaluation.
 *
 * Pure deterministic analysis of externally reviewed/validated run samples.
 * It does not call a model, infer correctness from execution success, or
 * manufacture baseline observations. Missing measurements remain unknown.
 */
export type ComparativeAssessmentSource = "ground_truth" | "human_review" | "automated_validator";

export type ComparativeQuality = {
  value: number;
  source: ComparativeAssessmentSource;
  validatorId: string;
};

export type ComparativeRunSample = {
  caseId: string;
  tool: string;
  quality?: {
    outputCorrectness?: ComparativeQuality;
    evidenceReliability?: ComparativeQuality;
    reasoningValidity?: ComparativeQuality;
  };
  tokens?: number | null;
  costUsd?: number | null;
  latencyMs?: number | null;
  integrationSucceeded?: boolean | null;
};

export type ComparativeCohort = {
  version: string;
  samples: ComparativeRunSample[];
};

export type ComparativeOptions = {
  maxQualityRegression?: number;
  maxCostIncreaseRatio?: number;
  maxLatencyIncreaseRatio?: number;
};

const QUALITY_KEYS = [
  "outputCorrectness",
  "evidenceReliability",
  "reasoningValidity",
] as const;

type QualityKey = typeof QUALITY_KEYS[number];

function validQuality(value: ComparativeQuality | undefined): value is ComparativeQuality {
  return !!value
    && Number.isFinite(value.value)
    && value.value >= 0
    && value.value <= 1
    && ["ground_truth", "human_review", "automated_validator"].includes(value.source)
    && typeof value.validatorId === "string"
    && value.validatorId.trim().length > 0;
}

function validNonNegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function indexSamples(samples: ComparativeRunSample[]) {
  const map = new Map<string, ComparativeRunSample>();
  const duplicates: string[] = [];
  for (const sample of samples) {
    const key = sample.caseId + "::" + sample.tool;
    if (!sample.caseId?.trim() || !sample.tool?.trim() || map.has(key)) {
      duplicates.push(key || "(missing case/tool)");
      continue;
    }
    map.set(key, sample);
  }
  return { map, duplicates };
}

function pairedMetric(
  pairs: Array<{ baseline: ComparativeRunSample; enhanced: ComparativeRunSample }>,
  getter: (sample: ComparativeRunSample) => number | null | undefined,
) {
  const values = pairs
    .map(({ baseline, enhanced }) => ({ before: getter(baseline), after: getter(enhanced) }))
    .filter((x): x is { before: number; after: number } => validNonNegative(x.before) && validNonNegative(x.after));
  if (!values.length) return { sampleSize: 0, baselineMean: null, enhancedMean: null, absoluteDelta: null, relativeDelta: null };
  const before = values.reduce((sum, x) => sum + x.before, 0) / values.length;
  const after = values.reduce((sum, x) => sum + x.after, 0) / values.length;
  return {
    sampleSize: values.length,
    baselineMean: Number(before.toFixed(6)),
    enhancedMean: Number(after.toFixed(6)),
    absoluteDelta: Number((after - before).toFixed(6)),
    relativeDelta: before === 0 ? null : Number(((after - before) / before).toFixed(6)),
  };
}

function pairedQuality(
  pairs: Array<{ baseline: ComparativeRunSample; enhanced: ComparativeRunSample }>,
  key: QualityKey,
) {
  const values = pairs
    .map(({ baseline, enhanced }) => ({ before: baseline.quality?.[key], after: enhanced.quality?.[key] }))
    .filter((x): x is { before: ComparativeQuality; after: ComparativeQuality } => validQuality(x.before) && validQuality(x.after));
  if (!values.length) return { sampleSize: 0, baselineMean: null, enhancedMean: null, absoluteDelta: null, sources: [] as string[] };
  const before = values.reduce((sum, x) => sum + x.before.value, 0) / values.length;
  const after = values.reduce((sum, x) => sum + x.after.value, 0) / values.length;
  return {
    sampleSize: values.length,
    baselineMean: Number(before.toFixed(6)),
    enhancedMean: Number(after.toFixed(6)),
    absoluteDelta: Number((after - before).toFixed(6)),
    sources: [...new Set(values.flatMap((x) => [x.before.source, x.after.source]))],
  };
}

/**
 * Compares only matched case/tool pairs. This is descriptive paired evidence,
 * not a significance test and not a single composite quality score.
 */
export function compareEvaluationCohorts(
  baseline: ComparativeCohort,
  enhanced: ComparativeCohort,
  options: ComparativeOptions = {},
) {
  const maxQualityRegression = options.maxQualityRegression ?? 0.02;
  const maxCostIncreaseRatio = options.maxCostIncreaseRatio ?? 0.1;
  const maxLatencyIncreaseRatio = options.maxLatencyIncreaseRatio ?? 0.2;
  const before = indexSamples(baseline.samples || []);
  const after = indexSamples(enhanced.samples || []);
  const pairs: Array<{ baseline: ComparativeRunSample; enhanced: ComparativeRunSample }> = [];
  const unmatchedBaseline: string[] = [];
  const unmatchedEnhanced: string[] = [];

  for (const [key, sample] of before.map) {
    const match = after.map.get(key);
    if (match) pairs.push({ baseline: sample, enhanced: match });
    else unmatchedBaseline.push(key);
  }
  for (const key of after.map.keys()) if (!before.map.has(key)) unmatchedEnhanced.push(key);

  const quality = Object.fromEntries(QUALITY_KEYS.map((key) => [key, pairedQuality(pairs, key)])) as Record<QualityKey, ReturnType<typeof pairedQuality>>;
  const tokens = pairedMetric(pairs, (sample) => sample.tokens);
  const costUsd = pairedMetric(pairs, (sample) => sample.costUsd);
  const latencyMs = pairedMetric(pairs, (sample) => sample.latencyMs);

  const integrationPairs = pairs.filter((pair) =>
    typeof pair.baseline.integrationSucceeded === "boolean"
    && typeof pair.enhanced.integrationSucceeded === "boolean");
  const integration = {
    sampleSize: integrationPairs.length,
    baselineSuccesses: integrationPairs.filter((x) => x.baseline.integrationSucceeded).length,
    enhancedSuccesses: integrationPairs.filter((x) => x.enhanced.integrationSucceeded).length,
    newlyFailed: integrationPairs.filter((x) => x.baseline.integrationSucceeded === true && x.enhanced.integrationSucceeded === false).length,
    recovered: integrationPairs.filter((x) => x.baseline.integrationSucceeded === false && x.enhanced.integrationSucceeded === true).length,
  };

  const blockers: string[] = [];
  for (const key of QUALITY_KEYS) {
    const metric = quality[key];
    if (metric.sampleSize === 0) blockers.push(key + ": no paired validated quality assessments");
    else if (metric.absoluteDelta !== null && metric.absoluteDelta < -maxQualityRegression) {
      blockers.push(key + ": quality regression exceeds allowed tolerance");
    }
  }
  if (integration.newlyFailed > 0) blockers.push("integration: one or more previously successful integrations now fail");
  if (costUsd.relativeDelta !== null && costUsd.relativeDelta > maxCostIncreaseRatio) blockers.push("cost: increase exceeds configured tolerance");
  if (latencyMs.relativeDelta !== null && latencyMs.relativeDelta > maxLatencyIncreaseRatio) blockers.push("latency: increase exceeds configured tolerance");
  if (pairs.length === 0) blockers.push("cohort: no matched baseline/enhanced cases");

  return {
    schemaVersion: "phase9-comparative-v1",
    baselineVersion: baseline.version,
    enhancedVersion: enhanced.version,
    design: "paired_case_and_tool_comparison",
    statisticalInference: "not_performed",
    matchedPairs: pairs.length,
    unmatchedBaseline,
    unmatchedEnhanced,
    duplicateBaselineKeys: before.duplicates,
    duplicateEnhancedKeys: after.duplicates,
    quality,
    execution: { tokens, costUsd, latencyMs, integration },
    acceptance: {
      status: blockers.length ? "not_accepted" : "eligible_for_human_review",
      blockers,
      note: "Eligibility is not automatic approval. Review sample adequacy, validator quality, task mix and material regressions before accepting.",
    },
    limitations: [
      "Only identical caseId/tool pairs are compared.",
      "Quality values require an explicit ground-truth, human-review or named automated-validator source.",
      "Missing metrics remain unmeasured; they are never treated as zero or success.",
      "No statistical significance, causal attribution, actual GEO ranking or AI-engine visibility is inferred.",
      "Cost and latency describe supplied run samples; they are not projected future performance.",
    ],
  };
}
