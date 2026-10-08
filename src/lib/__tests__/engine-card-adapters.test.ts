import { describe, it, expect } from "vitest";
import { fromStrategist, fromWhatIf, fromResearch, fromSuggestion } from "@/lib/engine-card-adapters";
describe("engine card adapters", () => {
  it("strategist only lists named engines as recommendations", () => {
    const r = fromStrategist({ priority_platforms: [{ engine: "ChatGPT", reason: "x" }, { engine: "unknown" }] });
    expect(r).toEqual([{ key: "chatgpt", text: "x", basis: "recommended" }]);
  });
  it("what-if computes after score", () => {
    expect(fromWhatIf({ engine_projections: [{ engine: "gemini", baseline_score: 50, projected_delta: "+10% to +30%" }] })[0].score).toBe(60);
  });
  it("empty results produce no cards", () => {
    expect(fromResearch({})).toEqual([]); expect(fromSuggestion({ variants: [] })).toEqual([]);
  });
  it("suggestion yields 9 estimated cards", () => {
    const r = fromSuggestion({ variants: [{ platform: "linkedin", content: "في 2026 نمت المبيعات 40% لدى 3 فروع", geo_score: 70 }] });
    expect(r).toHaveLength(9); expect(r.every((c) => c.basis === "estimated")).toBe(true);
  });
});
