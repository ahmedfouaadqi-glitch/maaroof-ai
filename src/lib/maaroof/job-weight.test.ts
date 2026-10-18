import { describe, expect, it } from "vitest";
import { assessJobWeight } from "./job-weight";

describe("assessJobWeight", () => {
  it("classifies a short task with no extra tools as light", () => {
    expect(assessJobWeight({ goal: "Summarize this page" }).weight).toBe("light");
  });

  it("raises weight for long goals and multiple tools", () => {
    const result = assessJobWeight({
      goal: "x".repeat(800),
      tools: ["research", "known", "compare"],
      selectedSkills: ["deep-research", "competitor-analysis"],
    });
    expect(result.weight).toBe("deep");
    expect(result.score).toBeGreaterThanOrEqual(55);
  });

  it("counts live model probes and unique engines", () => {
    const result = assessJobWeight({
      goal: "Check AI visibility",
      liveProbe: true,
      probeEngines: ["a", "b", "c", "d", "e", "f", "f"],
    });
    expect(result.engines_count).toBe(6);
    expect(result.weight).toBe("medium");
  });

  it("deduplicates tools and skills", () => {
    const result = assessJobWeight({
      goal: "Analyze",
      tools: ["research", "research"],
      selectedSkills: ["deep-research", "deep-research"],
    });
    expect(result.tools_count).toBe(1);
    expect(result.weight).toBe("light");
  });
});
