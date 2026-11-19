import { describe, expect, it } from "vitest";
import { hasExplicitWorkspaceScope, hasWorkspaceScopeQuery } from "./job-workspace-scope";

describe("explicit job workspace scope", () => {
  it("distinguishes an omitted scope from an explicit main-account scope", () => {
    expect(hasExplicitWorkspaceScope({})).toBe(false);
    expect(hasExplicitWorkspaceScope({ workspace_id: null })).toBe(true);
    expect(hasExplicitWorkspaceScope({ workspace_id: "" })).toBe(true);
  });

  it("requires the workspace_id query parameter even when its value is empty", () => {
    expect(hasWorkspaceScopeQuery(new URLSearchParams())).toBe(false);
    expect(hasWorkspaceScopeQuery(new URLSearchParams("workspace_id="))).toBe(true);
    expect(hasWorkspaceScopeQuery(new URLSearchParams("workspace_id=abc"))).toBe(true);
  });

  it("rejects non-object request payloads", () => {
    expect(hasExplicitWorkspaceScope(null)).toBe(false);
    expect(hasExplicitWorkspaceScope("workspace_id")).toBe(false);
    expect(hasExplicitWorkspaceScope([])).toBe(false);
  });
});
