import { describe, it, expect } from "vitest";
import { normalizeInterfacePolicy, postLoginTarget, resolveInterfacePolicy } from "@/lib/interface-policy";

describe("interface policy", () => {
  it("defaults to the new workspace for regular users", () => {
    expect(postLoginTarget(normalizeInterfacePolicy(undefined))).toBe("/workspace");
  });
  it("sends users to the professional dashboard when only professional is allowed", () => {
    expect(postLoginTarget(normalizeInterfacePolicy({ available_interfaces: ["professional"], default_ui: "workbench" }))).toBe("/dashboard");
  });
  it("respects professional default when both interfaces are allowed", () => {
    expect(postLoginTarget(normalizeInterfacePolicy({ available_interfaces: ["workbench", "professional"], default_ui: "professional" }))).toBe("/dashboard");
  });

  it("inherits all global settings when the user has no override", () => {
    const global = {
      available_interfaces: ["professional"],
      default_ui: "professional",
      landing: "classic",
      show_professional_link: false,
    };
    expect(resolveInterfacePolicy(global)).toEqual(normalizeInterfacePolicy(global));
  });

  it("applies a user-specific interface override without mutating the global policy", () => {
    const global = {
      available_interfaces: ["workbench", "professional"],
      default_ui: "workbench",
      landing: "new",
      show_professional_link: true,
    };
    const user = resolveInterfacePolicy(global, {
      available_interfaces: ["professional"],
      default_ui: "professional",
      landing: "classic",
      show_professional_link: false,
    });
    expect(user).toEqual({
      available_interfaces: ["professional"],
      default_ui: "professional",
      landing: "classic",
      show_professional_link: false,
    });
    expect(global.default_ui).toBe("workbench");
    expect(resolveInterfacePolicy(global, { landing: "classic" }).available_interfaces).toEqual(["workbench", "professional"]);
  });

  it("keeps the classic landing page when admin selects it", () => {
    expect(normalizeInterfacePolicy({ landing: "classic" }).landing).toBe("classic");
  });
});
