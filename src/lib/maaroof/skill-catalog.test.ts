import { describe, expect, it } from "vitest";
import { MAAROOF_SKILLS, recommendMaaroofSkills, toolsForSkills } from "./skill-catalog";

describe("MAAROOF user-facing skill catalog", () => {
  it("maps each skill to existing tool keys", () => {
    const known = new Set(["analyze", "suggest", "compare", "known", "feasibility", "bizdev", "research", "visibility", "brand_boost", "company_email", "applied_ranking", "geo_strategist", "competitor_monitor", "social_analysis", "what_if", "brand_authority", "geo_rewrite"]);
    for (const skill of MAAROOF_SKILLS) {
      expect(skill.tools.length).toBeGreaterThan(0);
      for (const tool of skill.tools) expect(known.has(tool)).toBe(true);
    }
  });

  it("recommends market intelligence for market opportunity goals", () => {
    const keys = recommendMaaroofSkills("حلل السوق العراقي واكتشف فرص النمو", 3).map(skill => skill.key);
    expect(keys).toContain("market-intelligence");
  });

  it("recommends competitor analysis for competitor comparison", () => {
    const keys = recommendMaaroofSkills("Compare my competitors and identify gaps", 3).map(skill => skill.key);
    expect(keys).toContain("competitor-analysis");
  });

  it("provides a deterministic fallback for empty or unmatched goals", () => {
    expect(recommendMaaroofSkills("", 3).map(skill => skill.key)).toEqual([
      "deep-research", "market-intelligence", "growth-strategy"
    ]);
    expect(recommendMaaroofSkills("xyz-123", 2)).toHaveLength(2);
  });

  it("deduplicates shared tools across selected skills", () => {
    const tools = toolsForSkills(["deep-research", "competitor-analysis"]);
    expect(new Set(tools).size).toBe(tools.length);
    expect(tools).toContain("research");
    expect(tools).toContain("known");
  });

  it("returns no tools for an unknown skill key", () => {
    expect(toolsForSkills(["not-a-skill"])).toEqual([]);
  });
});
