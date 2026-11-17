import { describe, expect, it } from "vitest";
import { workspaceScopedResultKey } from "./export-bus";

describe("workspace-scoped export result keys", () => {
  it("keeps the main account scope distinct from a client workspace", () => {
    expect(workspaceScopedResultKey(null, "visibility")).not.toBe(
      workspaceScopedResultKey("client-1", "visibility"),
    );
  });

  it("keeps two client workspaces isolated for the same tool", () => {
    expect(workspaceScopedResultKey("client-1", "visibility")).not.toBe(
      workspaceScopedResultKey("client-2", "visibility"),
    );
  });

  it("uses the same key for the same workspace and tool", () => {
    expect(workspaceScopedResultKey("client-1", "visibility")).toBe(
      workspaceScopedResultKey("client-1", "visibility"),
    );
  });
});
