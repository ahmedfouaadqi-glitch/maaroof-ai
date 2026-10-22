import { describe, it, expect } from "vitest";
import { skillForTool, workspaceSearchForDashboard, DASHBOARD_TO_CATALOG } from "./tool-skill-map";

describe("tool → skill map", () => {
  it("every old dashboard tool except the report builder belongs to a skill", () => {
    for (const tool of Object.values(DASHBOARD_TO_CATALOG)) {
      if (tool === "report") continue;
      expect(skillForTool(tool), tool).toBeTruthy();
    }
  });
  it("report builder is standalone", () => expect(skillForTool("report")).toBeUndefined());
  it("dashboard boost opens brand_boost inside a skill", () => {
    const s = workspaceSearchForDashboard("boost");
    expect(s.tool).toBe("brand_boost");
    expect(s.skill).toBeTruthy();
  });
  it("unknown dashboard tool opens the skills tab", () => expect(workspaceSearchForDashboard("nope")).toEqual({ tab: "skills" }));
});
