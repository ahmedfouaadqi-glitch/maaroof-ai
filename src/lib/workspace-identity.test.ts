import { describe, expect, it } from "vitest";
import { requireOwnedWorkspace } from "./workspace-identity";

describe("requireOwnedWorkspace", () => {
  const workspace = { id: "workspace-a", owner_id: "user-a", name: "Client A" };

  it("accepts only the requested workspace owned by the caller", () => {
    expect(requireOwnedWorkspace(workspace, "workspace-a", "user-a")).toBe(workspace);
  });

  it("rejects a missing workspace instead of allowing account-profile fallback", () => {
    expect(() => requireOwnedWorkspace(null, "workspace-a", "user-a"))
      .toThrow("workspace_identity_unavailable");
  });

  it("rejects a different workspace", () => {
    expect(() => requireOwnedWorkspace(workspace, "workspace-b", "user-a"))
      .toThrow("workspace_identity_unavailable");
  });

  it("rejects a workspace owned by another account", () => {
    expect(() => requireOwnedWorkspace(workspace, "workspace-a", "user-b"))
      .toThrow("workspace_identity_unavailable");
  });
});
