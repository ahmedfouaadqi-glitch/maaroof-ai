import { describe, it, expect } from "vitest";
import { MAAROOF_SKILLS, skillFramework } from "./skill-catalog";
import { TOOL_CATALOG } from "@/lib/tool-catalog";

describe("skill catalog", () => {
  it("has 17 skills", () => expect(MAAROOF_SKILLS.length).toBe(17));
  it("includes the four new skills", () => {
    const keys = MAAROOF_SKILLS.map((s) => s.key);
    for (const k of ["continuous_monitoring", "citation_fix", "smart_competitor", "machine_readability"]) expect(keys).toContain(k);
  });
  it("every skill uses only existing tools", () => {
    const tools = new Set((TOOL_CATALOG as any[]).map((t) => t.key));
    for (const s of MAAROOF_SKILLS) for (const t of s.tools) expect(tools.has(t)).toBe(true);
  });
  it("does not connect any skill to the temporarily paused monitor", () => {
    for (const skill of MAAROOF_SKILLS) expect(skill.tools).not.toContain("competitor_monitor");
    expect(MAAROOF_SKILLS.find((skill) => skill.key === "smart_competitor")?.tools).toEqual(["compare"]);
  });
  it("every skill has all seven framework parts", () => {
    for (const s of MAAROOF_SKILLS) {
      const f = skillFramework(s, "ar");
      for (const v of Object.values(f)) expect(v.length).toBeGreaterThan(0);
    }
  });
});
