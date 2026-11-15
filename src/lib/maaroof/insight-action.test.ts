import { describe, expect, it } from "vitest";
import { discoverFact, type FactCandidate } from "./fact-discovery";
import { evaluateInsightRules } from "./insight-engine";
import { buildRecommendation } from "./recommendation-engine";
import { evaluateActionPolicy } from "./action-policy";

const evidence = { source_kind: "crawl", source_ref: "https://shop.example", excerpt: "checkout", collected_at: "2026-11-15T10:00:00Z", collection_method: "public_http" };
const fact = (predicate: string, value: string): ReturnType<typeof discoverFact> => discoverFact({
  key: predicate, subject: "shop.example", predicate, value, kind: "observed_fact", evidence: [evidence],
} as FactCandidate);
const insight = evaluateInsightRules(
  [fact("checkout", "present"), fact("payment_policy", "missing")],
  [{ id: "rule-1", kind: "risk", title: "Payment policy gap", explanation: "The crawl did not find a payment policy.", requiredPredicates: ["checkout", "payment_policy"], expectedValues: { payment_policy: "missing" } }],
)[0]!;

describe("insight, recommendation and action policy", () => {
  it("creates only rules whose required evidence predicates match", () => {
    expect(insight?.fact_keys).toEqual(["checkout", "payment_policy"]);
    expect(insight?.status).toBe("evidence_linked");
    expect(evaluateInsightRules([fact("checkout", "present")], [{ id: "r", kind: "risk", title: "x", explanation: "x", requiredPredicates: ["checkout", "payment_policy"] }])).toEqual([]);
  });

  it("blocks recommendations with unvalidated insights or missing measured impact", () => {
    const rec = buildRecommendation({
      id: "rec-1", insight: { ...insight, status: "requires_validation" }, action: "Review payment page",
      rationale: "Validate the missing policy finding.", expectedImpact: null,
      cost: { amount: null, currency: null, basis: "not_estimated" }, effortHours: null,
      risk: "low", dependencies: [], reversible: true, requiresApproval: false,
    });
    expect(rec.status).toBe("blocked_insufficient_evidence");
    expect(rec.blockers).toContain("insight_requires_validation");
  });

  it("requires approval for financial and irreversible operations", () => {
    const rec = buildRecommendation({
      id: "rec-2", insight, action: "Change price", rationale: "Test price change",
      expectedImpact: { metric: "conversion_rate", baseline: 2, target: 2.2, unit: "%" },
      cost: { amount: 0, currency: "USD", basis: "known" }, effortHours: 1,
      risk: "high", dependencies: [], reversible: false, requiresApproval: false,
    });
    const decision = evaluateActionPolicy({
      risk: "financial", userApproved: false, workspaceAllowsAutomation: true,
      capabilityAvailable: true, idempotencyKey: "job-123", rollbackAvailable: false, recommendation: rec,
    });
    expect(decision.disposition).toBe("approval_required");
  });

  it("never marks an action eligible without capability and idempotency", () => {
    const rec = buildRecommendation({
      id: "rec-3", insight, action: "Review page", rationale: "Evidence-backed review",
      expectedImpact: { metric: "time_to_review", baseline: 10, target: 8, unit: "minutes" },
      cost: { amount: 0, currency: "USD", basis: "known" }, effortHours: 1,
      risk: "low", dependencies: [], reversible: true, requiresApproval: false,
    });
    const decision = evaluateActionPolicy({
      risk: "read_only", userApproved: true, workspaceAllowsAutomation: true,
      capabilityAvailable: false, idempotencyKey: null, rollbackAvailable: true, recommendation: rec,
    });
    expect(decision.disposition).toBe("blocked");
    expect(decision.reasons).toContain("execution_capability_unavailable");
    expect(decision.reasons).toContain("idempotency_key_required");
  });
});
