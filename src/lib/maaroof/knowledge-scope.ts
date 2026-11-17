/**
 * Validate ownership coordinates before inserting a knowledge node.
 * Workspace nodes are owned by the workspace and intentionally have user_id = NULL.
 */
export function isKnowledgeScopeValid(scope: "platform" | "workspace" | "user", userId?: string | null, workspaceId?: string | null): boolean {
  if (scope === "platform") return !userId && !workspaceId;
  if (scope === "workspace") return !!workspaceId && !userId;
  return !!userId && !workspaceId;
}

/**
 * PostgREST OR expression for knowledge recall.
 * Platform knowledge is intentionally shared. Workspace knowledge is restricted
 * to the exact workspace id; main-account knowledge requires the exact user id
 * and a null workspace id.
 */
export function knowledgeRecallScopeFilter(userId?: string | null, workspaceId?: string | null): string {
  const clauses = ["scope.eq.platform"];
  if (workspaceId) {
    clauses.push(`and(scope.eq.workspace,workspace_id.eq.${workspaceId})`);
  } else if (userId) {
    clauses.push(`and(scope.eq.user,user_id.eq.${userId},workspace_id.is.null)`);
  }
  return clauses.join(",");
}
