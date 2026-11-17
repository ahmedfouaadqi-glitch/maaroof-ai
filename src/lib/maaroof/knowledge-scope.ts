/**
 * PostgREST OR expression for knowledge recall.
 * Platform knowledge is intentionally shared. Workspace knowledge is restricted
 * to the exact workspace id; main-account knowledge requires a null workspace id
 * and the exact owner id.
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
