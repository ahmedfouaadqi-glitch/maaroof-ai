import { describe, expect, it } from "vitest";
import { estimateTaskWeight } from "./task-weight";

describe("estimateTaskWeight", () => {
  it("classifies an empty or short goal as light", () => {
    expect(estimateTaskWeight({ goal: "" })).toBe("light");
    expect(estimateTaskWeight({ goal: "Summarize this page" })).toBe("light");
  });

  it("classifies a normal goal as medium", () => {
    expect(estimateTaskWeight({ goal: "Research local competitors and summarize their public positioning" })).toBe("medium");
  });

  it("classifies broad multi-tool and multi-engine requests as deep", () => {
    expect(estimateTaskWeight({
      goal: "Conduct a comprehensive cross-market analysis, identify opportunities, compare competitors, validate sources, and prepare a detailed action plan with measurable recommendations.",
      selectedSkillCount: 4,
      selectedToolCount: 7,
      liveEngineCount: 10,
    })).toBe("deep");
  });
});
