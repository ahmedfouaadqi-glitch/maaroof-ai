/** Require an explicit workspace scope (including explicit null for the main account). */
export function hasExplicitWorkspaceScope(input: unknown): boolean {
  return !!input && typeof input === "object" && !Array.isArray(input)
    && Object.prototype.hasOwnProperty.call(input, "workspace_id");
}

/** URL query counterpart: an empty workspace_id explicitly selects the main account. */
export function hasWorkspaceScopeQuery(params: URLSearchParams): boolean {
  return params.has("workspace_id");
}
