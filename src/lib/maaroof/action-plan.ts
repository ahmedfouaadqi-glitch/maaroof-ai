import type { Recommendation } from "./recommendation-engine";
import { evaluateActionPolicy, type ActionPolicyInput, type ActionDecision } from "./action-policy";

export type PlannedAction = {
  id: string;
  recommendationId: string;
  dependsOn: string[];
  policy: Omit<ActionPolicyInput, "recommendation">;
};
export type ActionPlanResult = {
  ordered: Array<{ action: PlannedAction; decision: ActionDecision }>;
  blocked: Array<{ actionId: string; reasons: string[] }>;
  errors: string[];
  executableCount: 0;
};

/** Validates dependency graph and policy gates. This function never executes actions. */
export function buildActionPlan(
  actions: PlannedAction[],
  recommendations: Recommendation[],
): ActionPlanResult {
  const errors: string[] = [];
  const byId = new Map<string, PlannedAction>();
  for (const action of actions) {
    if (!action.id.trim()) errors.push("action_id_missing");
    if (byId.has(action.id)) errors.push(`duplicate_action_id:${action.id}`);
    byId.set(action.id, action);
  }
  for (const action of actions) {
    for (const dependency of action.dependsOn) {
      if (!byId.has(dependency)) errors.push(`missing_dependency:${action.id}:${dependency}`);
      if (dependency === action.id) errors.push(`self_dependency:${action.id}`);
    }
  }

  const indegree = new Map(actions.map((a) => [a.id, 0]));
  const outgoing = new Map(actions.map((a) => [a.id, [] as string[]]));
  for (const action of actions) {
    for (const dependency of action.dependsOn) {
      if (!byId.has(dependency) || dependency === action.id) continue;
      indegree.set(action.id, (indegree.get(action.id) || 0) + 1);
      outgoing.get(dependency)!.push(action.id);
    }
  }
  const queue = actions.filter((a) => indegree.get(a.id) === 0).map((a) => a.id);
  const orderedIds: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    orderedIds.push(id);
    for (const next of outgoing.get(id) || []) {
      const degree = (indegree.get(next) || 0) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }
  if (orderedIds.length !== byId.size) errors.push("dependency_cycle_detected");

  const recommendationById = new Map(recommendations.map((r) => [r.id, r]));
  const ordered = orderedIds.flatMap((id) => {
    const action = byId.get(id)!;
    const recommendation = recommendationById.get(action.recommendationId);
    if (!recommendation) {
      errors.push(`recommendation_not_found:${action.recommendationId}`);
      return [];
    }
    return [{ action, decision: evaluateActionPolicy({ ...action.policy, recommendation }) }];
  });
  const blocked = ordered
    .filter((entry) => entry.decision.disposition === "blocked")
    .map((entry) => ({ actionId: entry.action.id, reasons: entry.decision.reasons }));
  return { ordered, blocked, errors, executableCount: 0 };
}
