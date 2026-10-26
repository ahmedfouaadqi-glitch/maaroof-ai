// Pure rule: which rows belong to the selected workspace. null = main account (rows with no workspace).
export function inWorkspaceScope(rowWorkspaceId: string | null | undefined, activeWorkspaceId: string | null): boolean {
  return activeWorkspaceId ? rowWorkspaceId === activeWorkspaceId : !rowWorkspaceId;
}
