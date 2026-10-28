import { describe, it, expect } from "vitest";
import { MAAROOF_SKILLS, skillFramework } from "./skill-catalog";
import { TOOL_CATALOG } from "@/lib/tool-catalog";

describe("skill catalog", () => {
  it("has 18 skills", () => expect(MAAROOF_SKILLS.length).toBe(18));
  it("includes the four new skills", () => {
    const keys = MAAROOF_SKILLS.map((s) => s.key);
    for (const k of ["continuous_monitoring", "citation_fix", "smart_competitor", "machine_readability"]) expect(keys).toContain(k);
    expect(keys).toContain("search_visibility_strategy");
  });
  it("every skill uses only existing tools", () => {
    const tools = new Set((TOOL_CATALOG as any[]).map((t) => t.key));
    for (const s of MAAROOF_SKILLS) for (const t of [...s.tools, ...(s.methodologyTools || [])]) expect(tools.has(t)).toBe(true);
  });
  it("runs search visibility as one composite tool while retaining the existing methodology tools", () => {
    const skill = MAAROOF_SKILLS.find((item) => item.key === "search_visibility_strategy")!;
    expect(skill.tools).toEqual(["keyword_strategy"]);
    expect(skill.methodologyTools).toEqual(expect.arrayContaining(["analyze", "research", "compare", "visibility", "social_analysis", "brand_authority"]));
    expect(skillFramework(skill, "en").sources).toContain("ten-engine answers");
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
