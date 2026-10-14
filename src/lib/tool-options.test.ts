import { describe, it, expect } from "vitest";
import { TOOL_OPTIONS, describeToolOptions, enforceEnums } from "./tool-options";
import { TOOL_CATALOG } from "./tool-catalog";

describe("tool-options", () => {
  it("covers every agent-callable tool in the catalog that has options", () => {
    for (const k of Object.keys(TOOL_OPTIONS)) expect(TOOL_CATALOG.some((t) => t.key === k)).toBe(true);
  });
  it("describes tabs and enums", () => {
    expect(describeToolOptions("brand_boost")).toContain("propagation");
    expect(describeToolOptions("known")).toContain("depth ∈ {quick|deep}");
  });
  it("drops invalid enum values only", () => {
    expect(enforceEnums("known", { depth: "ultra", brand: "X" })).toEqual({ brand: "X" });
    expect(enforceEnums("known", { depth: "deep" })).toEqual({ depth: "deep" });
  });
});
