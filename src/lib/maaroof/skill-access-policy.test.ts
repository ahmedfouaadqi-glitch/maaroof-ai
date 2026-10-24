import { describe, it, expect } from "vitest";
import { resolveSkillAccessPolicy } from "./skill-access-policy";

describe("skill access precedence", () => {
  it("all skills are available by default", () => {
    const r = resolveSkillAccessPolicy({ globalPolicy: {}, byPlan: {}, byUser: {}, planKey: "" });
    expect(Object.values(r).every((m) => m === "self_service")).toBe(true);
  });
  it("global disable applies to everyone", () => {
    const r = resolveSkillAccessPolicy({ globalPolicy: { growth_roadmap: "disabled" }, byPlan: {}, byUser: {}, planKey: "pro" });
    expect(r.growth_roadmap).toBe("disabled");
  });
  it("plan overrides global, user overrides plan", () => {
    const opts = { globalPolicy: { growth_roadmap: "disabled" }, byPlan: { pro: { growth_roadmap: "contact" } }, byUser: { u1: { growth_roadmap: "self_service" } }, planKey: "pro" };
    expect(resolveSkillAccessPolicy(opts).growth_roadmap).toBe("contact");
    expect(resolveSkillAccessPolicy({ ...opts, userId: "u1" }).growth_roadmap).toBe("self_service");
  });
});
