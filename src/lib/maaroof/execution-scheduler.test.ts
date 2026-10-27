import { describe, expect, it } from "vitest";
import { buildExecutionBatches, dependenciesForStep } from "./execution-scheduler";

describe("Maaroof dependency-aware execution scheduling", () => {
  it("runs independent tools in bounded parallel waves", () => {
    expect(buildExecutionBatches([
      { tool: "analyze" },
      { tool: "research" },
      { tool: "visibility" },
      { tool: "suggest" },
    ], 3)).toEqual([[0, 1, 2], [3]]);
  });

  it("honors planner-declared dependencies by prior tool key", () => {
    const steps = [
      { tool: "research" },
      { tool: "analyze" },
      { tool: "compare", input: { brand: "Acme" }, depends_on: ["research"] },
    ];
    expect(dependenciesForStep(steps, 2)).toEqual([0]);
    expect(buildExecutionBatches(steps, 3)).toEqual([[0, 1], [2]]);
  });

  it("waits for competitor discovery before comparing when competitors are absent", () => {
    expect(buildExecutionBatches([
      { tool: "research", input: { query: "Acme competitors" } },
      { tool: "analyze", input: { brand: "Acme" } },
      { tool: "compare", input: { brand: "Acme" } },
    ], 3)).toEqual([[0, 1], [2]]);
  });

  it("waits for source content before GEO rewriting when no source text was supplied", () => {
    expect(buildExecutionBatches([
      { tool: "suggest" },
      { tool: "research" },
      { tool: "geo_rewrite", input: { text: "" } },
    ], 3)).toEqual([[0, 1], [2]]);
  });

  it("does not serialize rewriting with earlier tools when sufficient source text is supplied", () => {
    expect(buildExecutionBatches([
      { tool: "research" },
      { tool: "geo_rewrite", input: { text: "This is a sufficiently long source paragraph for rewriting." } },
    ], 3)).toEqual([[0, 1]]);
  });

  it("waits for all earlier outputs before translating or training knowledge", () => {
    expect(buildExecutionBatches([
      { tool: "analyze" },
      { tool: "research" },
      { tool: "translate" },
      { tool: "teach_space" },
    ], 3)).toEqual([[0, 1], [2], [3]]);
  });

  it("ignores dependencies that refer only to a later or missing tool", () => {
    const steps = [
      { tool: "analyze", depends_on: ["research", "unknown"] },
      { tool: "research" },
    ];
    expect(dependenciesForStep(steps, 0)).toEqual([]);
    expect(buildExecutionBatches(steps, 3)).toEqual([[0, 1]]);
  });

  it("keeps an explicit competitor list independent of research outputs", () => {
    expect(buildExecutionBatches([
      { tool: "research" },
      { tool: "compare", input: { competitors: ["Brand B", "Brand C"] } },
    ], 3)).toEqual([[0, 1]]);
  });
});
