import { describe, expect, it } from "vitest";
import { compareEvaluationCohorts, type ComparativeRunSample } from "./comparative-tests.server";

const sample = (overrides: Partial<ComparativeRunSample> = {}): ComparativeRunSample => ({
  caseId: "case-1",
  tool: "research",
  quality: {
    outputCorrectness: { value: 0.8, source: "human_review", validatorId: "review-rubric-v1" },
    evidenceReliability: { value: 0.75, source: "ground_truth", validatorId: "source-check-v1" },
    reasoningValidity: { value: 0.8, source: "human_review", validatorId: "reasoning-rubric-v1" },
  },
  tokens: 1000,
  costUsd: 0.02,
  latencyMs: 5000,
  integrationSucceeded: true,
  ...overrides,
});

describe("phase 9 paired comparative evaluation", () => {
  it("compares only matching case/tool pairs and reports deltas", () => {
    const result = compareEvaluationCohorts(
      { version: "baseline", samples: [sample()] },
      { version: "enhanced", samples: [sample({ quality: {
        outputCorrectness: { value: 0.9, source: "human_review", validatorId: "review-rubric-v1" },
        evidenceReliability: { value: 0.85, source: "ground_truth", validatorId: "source-check-v1" },
        reasoningValidity: { value: 0.9, source: "human_review", validatorId: "reasoning-rubric-v1" },
      }, tokens: 900, costUsd: 0.018, latencyMs: 4500 })] },
    );
    expect(result.matchedPairs).toBe(1);
    expect(result.quality.outputCorrectness.absoluteDelta).toBe(0.1);
    expect(result.execution.tokens.absoluteDelta).toBe(-100);
    expect(result.execution.costUsd.absoluteDelta).toBe(-0.002);
    expect(result.acceptance.status).toBe("eligible_for_human_review");
  });

  it("blocks quality regressions beyond tolerance", () => {
    const result = compareEvaluationCohorts(
      { version: "baseline", samples: [sample()] },
      { version: "enhanced", samples: [sample({ quality: {
        outputCorrectness: { value: 0.7, source: "human_review", validatorId: "review-rubric-v1" },
        evidenceReliability: { value: 0.75, source: "ground_truth", validatorId: "source-check-v1" },
        reasoningValidity: { value: 0.8, source: "human_review", validatorId: "reasoning-rubric-v1" },
      } })] },
    );
    expect(result.acceptance.status).toBe("not_accepted");
    expect(result.acceptance.blockers).toContain("outputCorrectness: quality regression exceeds allowed tolerance");
  });

  it("blocks newly failing integrations and excessive cost/latency increases", () => {
    const result = compareEvaluationCohorts(
      { version: "baseline", samples: [sample()] },
      { version: "enhanced", samples: [sample({ integrationSucceeded: false, costUsd: 0.03, latencyMs: 7000 })] },
    );
    expect(result.execution.integration.newlyFailed).toBe(1);
    expect(result.acceptance.blockers).toContain("integration: one or more previously successful integrations now fail");
    expect(result.acceptance.blockers).toContain("cost: increase exceeds configured tolerance");
    expect(result.acceptance.blockers).toContain("latency: increase exceeds configured tolerance");
  });

  it("does not infer quality when assessments or validator identities are missing", () => {
    const result = compareEvaluationCohorts(
      { version: "baseline", samples: [sample({ quality: undefined })] },
      { version: "enhanced", samples: [sample({ quality: undefined })] },
    );
    expect(result.quality.outputCorrectness.sampleSize).toBe(0);
    expect(result.quality.outputCorrectness.absoluteDelta).toBeNull();
    expect(result.acceptance.status).toBe("not_accepted");
  });

  it("keeps unmatched cases separate and does not treat them as paired evidence", () => {
    const result = compareEvaluationCohorts(
      { version: "baseline", samples: [sample()] },
      { version: "enhanced", samples: [sample({ caseId: "case-2" })] },
    );
    expect(result.matchedPairs).toBe(0);
    expect(result.unmatchedBaseline).toEqual(["case-1::research"]);
    expect(result.unmatchedEnhanced).toEqual(["case-2::research"]);
    expect(result.statisticalInference).toBe("not_performed");
    expect(result.acceptance.status).toBe("not_accepted");
  });

  it("rejects duplicate case/tool keys from paired analysis", () => {
    const result = compareEvaluationCohorts(
      { version: "baseline", samples: [sample(), sample()] },
      { version: "enhanced", samples: [sample()] },
    );
    expect(result.duplicateBaselineKeys).toEqual(["case-1::research"]);
    expect(result.matchedPairs).toBe(1);
  });

  it("does not turn zero baselines into an invented relative delta", () => {
    const result = compareEvaluationCohorts(
      { version: "baseline", samples: [sample({ costUsd: 0 })] },
      { version: "enhanced", samples: [sample({ costUsd: 0.01 })] },
    );
    expect(result.execution.costUsd.relativeDelta).toBeNull();
  });
});
