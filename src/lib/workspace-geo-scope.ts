export type WorkspaceGeoScope =
  | { scope: "world" }
  | { scope: "country"; country: string };

export function workspaceGeoScope(workspace: any): WorkspaceGeoScope {
  const card = workspace?.entity_truth_card && typeof workspace.entity_truth_card === "object"
    ? workspace.entity_truth_card
    : {};
  const raw = [
    workspace?.country,
    card.country,
    card.country_name,
    card.hq_country,
  ].find((value) => typeof value === "string" && value.trim());
  const country = String(raw || "").trim();
  if (!country || /\b(global|world|worldwide)\b|عالمي|العالم/i.test(country)) return { scope: "world" };
  return { scope: "country", country };
}

export function effectiveWorkspaceGeoScope<T extends { scope: string }>(
  workspaceId: string | null | undefined,
  workspace: any,
  accountScope: T,
): T | WorkspaceGeoScope {
  return workspaceId ? workspaceGeoScope(workspace?.id === workspaceId ? workspace : null) : accountScope;
}
