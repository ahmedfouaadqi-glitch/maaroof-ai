/**
 * Fail-closed validation for workspace-scoped execution.
 * A selected workspace must resolve to the exact workspace owned by the caller.
 * Never replace missing workspace identity with the account-level profile.
 */
export type WorkspaceIdentityRow = {
  id?: string | null;
  owner_id?: string | null;
  name?: string | null;
  [key: string]: unknown;
};

export function requireOwnedWorkspace<T extends WorkspaceIdentityRow>(
  row: T | null | undefined,
  workspaceId: string,
  ownerId: string,
): T {
  if (!row || row.id !== workspaceId || row.owner_id !== ownerId) {
    throw new Error("workspace_identity_unavailable");
  }
  return row;
}
