/**
 * PostgREST OR expression for knowledge recall.
 * Workspace runs may read platform knowledge and rows belonging to the exact
 * (user_id, workspace_id) pair only. Main-account runs may read platform
 * knowledge and account rows with a null workspace_id only.
 */
export function knowledgeRecallScopeFilter(userId?: string | null, workspaceId?: string | null): string {
  const clauses = ["scope.eq.platform"];
  if (userId && workspaceId) {
    clauses.push(`and(user_id.eq.${userId},workspace_id.eq.${workspaceId})`);
  } else if (userId) {
    clauses.push(`and(user_id.eq.${userId},workspace_id.is.null)`);
  }
  return clauses.join(",");
}
