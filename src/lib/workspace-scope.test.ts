import { describe, it, expect } from "vitest";
import { inWorkspaceScope } from "./workspace-scope";

describe("inWorkspaceScope", () => {
  it("main account sees only rows without a workspace", () => {
    expect(inWorkspaceScope(null, null)).toBe(true);
    expect(inWorkspaceScope("ws-a", null)).toBe(false);
  });
  it("a workspace sees only its own rows, not main-account rows", () => {
    expect(inWorkspaceScope("ws-a", "ws-a")).toBe(true);
    expect(inWorkspaceScope(null, "ws-a")).toBe(false);
    expect(inWorkspaceScope("ws-b", "ws-a")).toBe(false);
  });
});
