import { describe, expect, it } from "vitest";
import { knowledgeRecallScopeFilter } from "./knowledge-scope";

describe("knowledgeRecallScopeFilter", () => {
  it("allows platform and only the exact user/workspace pair for a client workspace", () => {
    expect(knowledgeRecallScopeFilter("user-a", "workspace-a"))
      .toBe("scope.eq.platform,and(user_id.eq.user-a,workspace_id.eq.workspace-a)");
  });

  it("keeps account-level knowledge separate from client workspaces", () => {
    expect(knowledgeRecallScopeFilter("user-a", null))
      .toBe("scope.eq.platform,and(user_id.eq.user-a,workspace_id.is.null)");
  });

  it("allows only platform knowledge when no user identity is supplied", () => {
    expect(knowledgeRecallScopeFilter(null, null)).toBe("scope.eq.platform");
  });
});
