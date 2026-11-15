import type { InsightResult } from "./insight-engine";

export type RecommendationInput = {
  id: string;
  insight: InsightResult;
  action: string;
  rationale: string;
  /** Use source-backed measurements only. Unknown values must remain null. */
  expectedImpact: { metric: string; baseline: number | null; target: number | null; unit?: string | null } | null;
  cost: { amount: number | null; currency: string | null; basis: string };
  effortHours: number | null;
  risk: "low" | "medium" | "high" | "unknown";
  dependencies: string[];
  reversible: boolean | null;
  requiresApproval: boolean;
};

export type Recommendation = RecommendationInput & {
  status: "ready_for_review" | "blocked_insufficient_evidence";
  blockers: string[];
};

/** Validates recommendation completeness; deliberately does not invent impact or ROI. */
export function buildRecommendation(input: RecommendationInput): Recommendation {
  const blockers: string[] = [];
  if (!input.id.trim()) blockers.push("recommendation_id_missing");
  if (!input.action.trim()) blockers.push("action_missing");
  if (!input.rationale.trim()) blockers.push("rationale_missing");
  if (input.insight.status !== "evidence_linked") blockers.push("insight_requires_validation");
  if (!input.insight.fact_keys.length) blockers.push("evidence_links_missing");
  if (input.cost.amount !== null && (!Number.isFinite(input.cost.amount) || input.cost.amount < 0)) blockers.push("invalid_cost");
  if (input.effortHours !== null && (!Number.isFinite(input.effortHours) || input.effortHours < 0)) blockers.push("invalid_effort");
  if (input.expectedImpact && (!input.expectedImpact.metric.trim() ||
    (input.expectedImpact.baseline !== null && !Number.isFinite(input.expectedImpact.baseline)) ||
    (input.expectedImpact.target !== null && !Number.isFinite(input.expectedImpact.target)))) blockers.push("invalid_impact_measurement");
  if (input.expectedImpact && (input.expectedImpact.baseline === null || input.expectedImpact.target === null)) blockers.push("impact_not_fully_measured");
  return { ...input, status: blockers.length ? "blocked_insufficient_evidence" : "ready_for_review", blockers };
}
