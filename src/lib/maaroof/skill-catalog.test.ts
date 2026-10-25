import { describe, it, expect } from "vitest";
import { MAAROOF_SKILLS, skillFramework } from "./skill-catalog";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { DIRECT_ROUTE_PATHS } from "./direct-tool-dispatch.server";
import { toolContractDiagnostics } from "./tool-contracts";
import { EXECUTABLE_TOOLS } from "./skill-inference";
import { normalizeSkillText, recommendMaaroofSkills } from "./skill-catalog";

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
  it("every skill has all seven framework parts", () => {
    for (const s of MAAROOF_SKILLS) {
      const f = skillFramework(s, "ar");
      for (const v of Object.values(f)) expect(v.length).toBeGreaterThan(0);
    }
  });

  it("links every skill only to executable routes or existing internal runners", () => {
    const errors = toolContractDiagnostics({
      skills: MAAROOF_SKILLS,
      catalogueKeys: TOOL_CATALOG.map((t) => t.key),
      directRoutePaths: DIRECT_ROUTE_PATHS,
    });
    expect(errors).toEqual([]);
    for (const skill of MAAROOF_SKILLS) for (const tool of skill.tools) expect(EXECUTABLE_TOOLS.has(tool)).toBe(true);
  });

  it("normalizes Arabic orthography and common local social-media phrasing", () => {
    expect(normalizeSkillText("إِنْسْتا")).toContain("instagram");
    expect(recommendMaaroofSkills("راجع حساب الانستا وحضوره الاجتماعي").map((s) => s.key)).toContain("market_intel");
    expect(recommendMaaroofSkills("تحسين محركات البحث للموقع").map((s) => s.key)).toContain("entity_readiness");
  });

  it("does not trigger a skill on a weak substring-only hit", () => {
    expect(recommendMaaroofSkills("unrelatedgrowth", MAAROOF_SKILLS.length).map((s) => s.key)).not.toContain("growth_roadmap");
  });

});
