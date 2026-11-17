import { describe, expect, it } from "vitest";
import { isKnowledgeScopeValid, knowledgeRecallScopeFilter } from "./knowledge-scope";

describe("isKnowledgeScopeValid", () => {
  it("requires a workspace id and a null user id for workspace-owned nodes", () => {
    expect(isKnowledgeScopeValid("workspace", null, "workspace-a")).toBe(true);
    expect(isKnowledgeScopeValid("workspace", "user-a", "workspace-a")).toBe(false);
    expect(isKnowledgeScopeValid("workspace", null, null)).toBe(false);
  });

  it("requires a user id and null workspace id for account-level nodes", () => {
    expect(isKnowledgeScopeValid("user", "user-a", null)).toBe(true);
    expect(isKnowledgeScopeValid("user", "user-a", "workspace-a")).toBe(false);
    expect(isKnowledgeScopeValid("user", null, null)).toBe(false);
  });

  it("keeps platform nodes free of user and workspace ownership", () => {
    expect(isKnowledgeScopeValid("platform", null, null)).toBe(true);
    expect(isKnowledgeScopeValid("platform", "user-a", null)).toBe(false);
  });
});

describe("knowledgeRecallScopeFilter", () => {
  it("allows platform and only the exact workspace partition for a client run", () => {
    expect(knowledgeRecallScopeFilter("user-a", "workspace-a"))
      .toBe("scope.eq.platform,and(scope.eq.workspace,workspace_id.eq.workspace-a)");
  });

  it("keeps main-account knowledge separate from client workspaces", () => {
    expect(knowledgeRecallScopeFilter("user-a", null))
      .toBe("scope.eq.platform,and(scope.eq.user,user_id.eq.user-a,workspace_id.is.null)");
  });

  it("allows only platform knowledge when no user identity is supplied", () => {
    expect(knowledgeRecallScopeFilter(null, null)).toBe("scope.eq.platform");
  });
});
