import { describe, expect, it } from "vitest";
import {
  buildReasoningGuidance,
  classifyReasoningIntent,
  validateReasoningPlan,
} from "./reasoning.server";

describe("reasoning intent classification", () => {
  it("detects Arabic GEO and SEO requests", () => {
    const result = classifyReasoningIntent("حلل ظهور العلامة في محركات الذكاء الاصطناعي وSEO");
    expect(result.intents).toContain("brand_visibility");
    expect(result.evidenceRequired).toBe(true);
  });

  it("detects mixed research and competitor intent", () => {
    const result = classifyReasoningIntent("ابحث عن المنافسين وقارن مصادر السوق");
    expect(result.intents).toContain("research");
    expect(result.intents).toContain("competitive_intelligence");
  });

  it("flags external actions and high risk without authorizing them", () => {
    const result = classifyReasoningIntent("انشر الحملة وأرسل البريد للعملاء");
    expect(result.externalActionRequested).toBe(true);
    expect(result.risk).toBe("high");
    expect(buildReasoningGuidance(result)).toContain("keep existing approval gates");
  });

  it("does not force a domain for a general request", () => {
    expect(classifyReasoningIntent("مرحبا").primaryIntent).toBe("general");
  });
});

describe("reasoning plan validation", () => {
  it("rejects unknown and paused tools", () => {
    const result = validateReasoningPlan([
      { tool: "made_up_tool", input: {} },
      { tool: "competitor_monitor", input: {} },
      { tool: "research", input: { query: "market" } },
    ], ["research"], 8);
    expect(result.steps.map((step) => step.tool)).toEqual(["research"]);
    expect(result.rejectedTools).toEqual(["made_up_tool", "competitor_monitor"]);
  });

  it("keeps only dependencies that refer to an earlier valid step", () => {
    const result = validateReasoningPlan([
      { tool: "research", input: {} },
      { tool: "compare", input: {}, depends_on: ["research", "later", "research"] },
    ], ["research", "competitive_intelligence"], 8);
    expect(result.steps[1].depends_on).toEqual(["research"]);
    expect(result.rejectedDependencies).toEqual(["later"]);
  });

  it("reports missing domain coverage without inventing extra tool steps", () => {
    const result = validateReasoningPlan(
      [{ tool: "suggest", input: {} }],
      ["business_strategy"],
      8,
    );
    expect(result.steps).toHaveLength(1);
    expect(result.coverageWarnings).toEqual(["missing_tool_coverage:business_strategy"]);
  });

  it("enforces the maximum step count", () => {
    const result = validateReasoningPlan([
      { tool: "research" }, { tool: "suggest" }, { tool: "analyze" },
    ], ["general"], 2);
    expect(result.steps).toHaveLength(2);
  });
});
