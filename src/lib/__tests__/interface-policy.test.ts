import { describe, it, expect } from "vitest";
import { normalizeInterfacePolicy, postLoginTarget } from "@/lib/interface-policy";

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
  it("keeps the classic landing page when admin selects it", () => {
    expect(normalizeInterfacePolicy({ landing: "classic" }).landing).toBe("classic");
  });
});
