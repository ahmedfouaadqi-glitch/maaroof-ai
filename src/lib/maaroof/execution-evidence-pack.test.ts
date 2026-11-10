import { describe, expect, it } from "vitest";
import { buildExecutionEvidencePack } from "./execution-evidence-pack";

describe("execution evidence pack", () => {
  it("labels tool outputs without claiming independent verification", () => {
    const pack = buildExecutionEvidencePack("Audit brand", [
      { tool: "analyze", ok: true, output: { score: 72 } },
    ]);
    expect(pack.text).toContain("Tool result: analyze");
    expect(pack.text).toContain("not automatically independent-source verification");
    expect(pack.successful).toBe(1);
  });

  it("removes exact duplicate outputs while preserving distinct tool results", () => {
    const pack = buildExecutionEvidencePack("Research", [
      { tool: "research", ok: true, output: { result: "same", count: 1 } },
      { tool: "research", ok: true, output: { count: 1, result: "same" } },
      { tool: "known", ok: true, output: { result: "different" } },
    ]);
    expect(pack.duplicateCount).toBe(1);
    expect(pack.included).toBe(2);
    expect(pack.text.match(/Tool result:/g)).toHaveLength(2);
  });

  it("keeps failed steps as limitations and does not mix them with successful evidence", () => {
    const pack = buildExecutionEvidencePack("Audit", [
      { tool: "analyze", ok: true, output: { score: 50 } },
      { tool: "visibility", ok: false, output: { error: "timeout" } },
    ]);
    expect(pack.text).toContain("Execution limitations");
    expect(pack.text).toContain("visibility");
    expect(pack.successful).toBe(1);
    expect(pack.failed).toBe(1);
  });

  it("bounds prompt size and reports omitted outputs", () => {
    const results = Array.from({ length: 8 }, (_, i) => ({
      tool: "tool_" + i, ok: true, output: { text: "x".repeat(2000) },
    }));
    const pack = buildExecutionEvidencePack("Large task", results, {
      maxChars: 1800, maxItems: 8, perItemChars: 1000,
    });
    expect(pack.text.length).toBeLessThanOrEqual(1800);
    expect(pack.omitted).toBeGreaterThan(0);
    expect(pack.text).toContain("omitted");
  });

  it("handles empty results without inventing evidence", () => {
    const pack = buildExecutionEvidencePack("No execution", []);
    expect(pack.included).toBe(0);
    expect(pack.successful).toBe(0);
    expect(pack.text).toContain("Successful tool outputs: 0");
  });
});
