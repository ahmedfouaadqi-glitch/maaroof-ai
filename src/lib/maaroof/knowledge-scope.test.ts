import { describe, expect, it } from "vitest";
import { knowledgeRecallScopeFilter } from "./knowledge-scope";

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
