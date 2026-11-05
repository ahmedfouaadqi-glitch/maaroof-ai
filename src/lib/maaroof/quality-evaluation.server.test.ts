import { describe, expect, it } from "vitest";
import { evaluateRunQuality, TOOL_QUALITY_RUBRICS } from "./quality-evaluation.server";
import { TOOL_CATALOG } from "@/lib/tool-catalog";

describe("phase 8 quality evaluation", () => {
  it("defines a dedicated rubric for every existing catalogue entry without changing the catalogue", () => {
    for (const tool of TOOL_CATALOG) {
      expect(TOOL_QUALITY_RUBRICS[tool.key], tool.key).toBeDefined();
    }
  });

  it("separates observed tool execution from model-estimated and historical quality", () => {
    const report = evaluateRunQuality("Research a brand", [
      { tool: "research", ok: true, output: { sources: ["https://example.com/a"] } },
      { tool: "compare", ok: false, output: { error: "timeout" } },
    ], { tokens: 1200, costUsd: 0.02 });
    expect(report.observedExecution.sampleSize).toBe(2);
    expect(report.observedExecution.toolExecutionSuccessRate).toBe(0.5);
    expect(report.modelEstimatedQuality.status).toBe("not_evaluated");
    expect(report.modelEstimatedQuality.score).toBeNull();
    expect(report.historicalPerformance.status).toBe("not_measured");
  });

  it("does not turn a reference URL count into source reliability", () => {
    const report = evaluateRunQuality("Research", [
      { tool: "research", ok: true, output: { links: ["https://one.example", "https://two.example"] } },
    ]);
    const item = report.toolEvaluations[0];
    expect(item.referenceUrlCount).toBe(2);
    const reliability = item.criteria.find((c) => c.id === "source_reliability");
    expect(reliability?.status).toBe("not_measured");
    expect(reliability?.value).toBeNull();
  });

  it("keeps tool-specific quality criteria unmeasured without validators or ground truth", () => {
    const report = evaluateRunQuality("Write social content", [
      { tool: "suggest", ok: true, output: { text: "A sample post" } },
      { tool: "visibility", ok: true, output: { score: 80 } },
    ]);
    expect(report.toolEvaluations[0].criteria.map((c) => c.id)).toContain("geo_readiness");
    expect(report.toolEvaluations[0].criteria.every((c) => c.value === null)).toBe(true);
    expect(report.toolEvaluations[1].criteria.find((c) => c.id === "geo_observation")?.status).toBe("not_measured");
  });

  it("supports a run with no tool calls without claiming a perfect score", () => {
    const report = evaluateRunQuality("General question", []);
    expect(report.observedExecution.toolExecutionSuccessRate).toBeNull();
    expect(report.observedExecution.sampleSize).toBe(0);
  });

  it("does not claim historical or statistical performance from one run", () => {
    const report = evaluateRunQuality("Task", [
      { tool: "analyze", ok: true, output: { result: "done" } },
    ]);
    expect(report.observedExecution.scope).toContain("single run only");
    expect(report.historicalPerformance.sampleSize).toBeNull();
    expect(report.guardrails.some((x) => x.includes("No aggregate quality score"))).toBe(true);
  });
});
