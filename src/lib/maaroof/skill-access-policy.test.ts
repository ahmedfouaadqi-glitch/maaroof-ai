import { describe, expect, it } from "vitest";
import { resolveScopedAccessMode, resolveSkillAccessPolicy } from "./skill-access-policy";

describe("scoped skill access policy", () => {
  it("uses the global policy when no scoped override exists", () => {
    const policy = resolveSkillAccessPolicy({ globalPolicy: { "deep-research": "contact" } });
    expect(policy["deep-research"]).toBe("contact");
    expect(policy["market-intelligence"]).toBe("self_service");
  });

  it("applies plan overrides over global defaults", () => {
    const policy = resolveSkillAccessPolicy({
      globalPolicy: { "deep-research": "disabled" },
      byPlan: { pro: { "deep-research": "self_service" } },
      planKey: " Pro ",
    });
    expect(policy["deep-research"]).toBe("self_service");
  });

  it("applies user overrides over plan and global settings", () => {
    const policy = resolveSkillAccessPolicy({
      globalPolicy: { "deep-research": "disabled" },
      byPlan: { pro: { "deep-research": "contact" } },
      byUser: { "user-123": { "deep-research": "self_service" } },
      planKey: "PRO",
      userId: "user-123",
    });
    expect(policy["deep-research"]).toBe("self_service");
  });

  it("keeps unrelated skills inherited when only one key is overridden", () => {
    const policy = resolveSkillAccessPolicy({
      byPlan: { pro: { "brand-visibility": "contact" } },
      planKey: "pro",
    });
    expect(policy["brand-visibility"]).toBe("contact");
    expect(policy["deep-research"]).toBe("self_service");
  });
});


describe("scoped access mode resolution", () => {
  it("uses explicit self-service user overrides over plan and global gates", () => {
    expect(resolveScopedAccessMode({
      key: "analyze",
      globalPolicy: { analyze: "disabled" },
      byPlan: { pro: { analyze: "contact" } },
      byUser: { "user-123": { analyze: "self_service" } },
      planKey: "PRO",
      userId: "user-123",
    })).toBe("self_service");
  });

  it("falls back from user to plan and then global when a scope has no key", () => {
    expect(resolveScopedAccessMode({
      key: "analyze",
      globalPolicy: { analyze: "self_service" },
      byPlan: { pro: { analyze: "contact" } },
      byUser: { "user-123": { other_tool: "disabled" } },
      planKey: "pro",
      userId: "user-123",
    })).toBe("contact");
  });

  it("defaults unknown modes to self-service instead of applying malformed policy data", () => {
    expect(resolveScopedAccessMode({
      key: "analyze",
      globalPolicy: { analyze: "unexpected-value" as any },
    })).toBe("self_service");
  });
});
