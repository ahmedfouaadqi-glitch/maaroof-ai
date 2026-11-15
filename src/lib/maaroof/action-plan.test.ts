import { describe, expect, it } from "vitest";
import { buildActionPlan } from "./action-plan";
import { buildRecommendation } from "./recommendation-engine";
import type { InsightResult } from "./insight-engine";

const insight: InsightResult = {
  id: "i1", rule_id: "r1", kind: "opportunity", title: "Evidence-backed insight",
  explanation: "Supported by collected evidence.", fact_keys: ["f1"],
  status: "evidence_linked", validation_notes: [],
};
const recommendation = buildRecommendation({
  id: "rec1", insight, action: "Review the page", rationale: "Fix an evidenced gap",
  expectedImpact: { metric: "review_time", baseline: 10, target: 8, unit: "minutes" },
  cost: { amount: 0, currency: "USD", basis: "known" }, effortHours: 1,
  risk: "low", dependencies: [], reversible: true, requiresApproval: false,
});
const policy = {
  risk: "read_only" as const, userApproved: true, workspaceAllowsAutomation: true,
  capabilityAvailable: true, idempotencyKey: "stable-key", rollbackAvailable: true,
};

describe("action plan validation", () => {
  it("orders dependent actions and never executes them", () => {
    const result = buildActionPlan([
      { id: "second", recommendationId: "rec1", dependsOn: ["first"], policy },
      { id: "first", recommendationId: "rec1", dependsOn: [], policy },
    ], [recommendation]);
    expect(result.errors).toEqual([]);
    expect(result.ordered.map((x) => x.action.id)).toEqual(["first", "second"]);
    expect(result.executableCount).toBe(0);
  });

  it("detects missing dependencies and cycles", () => {
    const result = buildActionPlan([
      { id: "a", recommendationId: "rec1", dependsOn: ["b"], policy },
      { id: "b", recommendationId: "rec1", dependsOn: ["a"], policy },
      { id: "c", recommendationId: "rec1", dependsOn: ["missing"], policy },
    ], [recommendation]);
    expect(result.errors).toContain("dependency_cycle_detected");
    expect(result.errors).toContain("missing_dependency:c:missing");
  });

  it("requires approval for public and financial writes", () => {
    const result = buildActionPlan([
      { id: "publish", recommendationId: "rec1", dependsOn: [], policy: { ...policy, risk: "external_write", userApproved: false } },
    ], [recommendation]);
    expect(result.ordered[0].decision.disposition).toBe("approval_required");
  });
});
