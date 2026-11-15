import type { Recommendation } from "./recommendation-engine";

export type ActionRisk = "read_only" | "reversible" | "external_write" | "financial" | "irreversible";
export type ActionPolicyInput = {
  risk: ActionRisk;
  userApproved: boolean;
  workspaceAllowsAutomation: boolean;
  capabilityAvailable: boolean;
  idempotencyKey: string | null;
  rollbackAvailable: boolean;
  recommendation: Recommendation;
};
export type ActionDecision = {
  disposition: "auto_eligible" | "approval_required" | "blocked";
  reasons: string[];
};

/**
 * Policy gate only. It never executes tools.
 * A caller must still verify tool authorization, workspace scope and idempotency.
 */
export function evaluateActionPolicy(input: ActionPolicyInput): ActionDecision {
  const reasons: string[] = [];
  if (input.recommendation.status !== "ready_for_review") reasons.push("recommendation_not_ready");
  if (!input.capabilityAvailable) reasons.push("execution_capability_unavailable");
  if (!input.idempotencyKey?.trim()) reasons.push("idempotency_key_required");
  if (input.risk === "reversible" && !input.rollbackAvailable) reasons.push("rollback_or_compensation_required");
  if (reasons.length) return { disposition: "blocked", reasons };

  const highImpact = ["external_write", "financial", "irreversible"].includes(input.risk);
  if (highImpact || input.recommendation.requiresApproval || !input.workspaceAllowsAutomation || !input.userApproved) {
    if (highImpact) reasons.push("high_impact_action_requires_explicit_approval");
    if (input.recommendation.requiresApproval) reasons.push("recommendation_requires_approval");
    if (!input.workspaceAllowsAutomation) reasons.push("workspace_automation_not_enabled");
    if (!input.userApproved) reasons.push("explicit_user_approval_missing");
    return { disposition: "approval_required", reasons };
  }
  return { disposition: "auto_eligible", reasons: ["policy_conditions_satisfied_no_execution_performed"] };
}
