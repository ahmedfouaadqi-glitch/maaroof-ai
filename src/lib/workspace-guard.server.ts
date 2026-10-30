// Workspace isolation for direct tool routes. When a request names a workspace,
// it must belong to the signed-in user; otherwise the tool refuses to run.
// Requests without a workspace keep running on the user's main account (unchanged behavior).

export function pickWorkspaceId(body: any): string | null {
  const v = body?.workspace_id ?? body?.workspaceId ?? null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Returns a 403/404 Response when the workspace is not owned by the user, else null. */
export async function workspaceGuard(admin: any, userId: string | null | undefined, body: any): Promise<Response | null> {
  const workspaceId = pickWorkspaceId(body);
  if (!workspaceId) return null;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return Response.json({ error: "workspace_not_found" }, { status: 404 });
  try {
    const { data } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
    if (!data) return Response.json({ error: "workspace_not_found" }, { status: 404 });
    return null;
  } catch {
    return Response.json({ error: "workspace_check_failed" }, { status: 503 });
  }
}
