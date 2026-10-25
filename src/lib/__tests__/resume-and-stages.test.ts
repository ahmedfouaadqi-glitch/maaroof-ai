import { describe, it, expect } from "vitest";
import { pipelineCards } from "@/lib/maaroof/pipeline-cards";
import { reusableResults } from "@/lib/maaroof/jobs";

describe("stage order and stop labels", () => {
  it("orders evidence before the ten-model council, then conflict resolution", () => {
    expect(pipelineCards([], false).map((c) => c.key)).toEqual(["understand", "plan", "evidence", "council", "conflict", "result"]);
  });
  it("a task that errored marks later stages as stopped, not skipped", () => {
    const cards = pipelineCards([{ type: "phase", data: { phase: "planning" } }, { type: "tool_call", data: { tool: "analyze" } }, { type: "error", data: {} }], false);
    expect(cards.find((c) => c.key === "result")!.state).toBe("stopped");
  });
  it("names failed tools on the evidence card", () => {
    const cards = pipelineCards([{ type: "tool_result", data: { tool: "brand_authority", ok: false, output: { error: "x" } } }], false);
    expect(cards.find((c) => c.key === "evidence")!.failedTools).toEqual(["brand_authority"]);
  });
});

describe("smart resume", () => {
  it("reuses only successful tool results", () => {
    const r = reusableResults([
      { tool: "analyze", ok: true, output: { score: 1 } },
      { tool: "known", ok: false, output: { error: "tool_disabled" } },
      { tool: "visibility", ok: true, output: { skipped: "x" } },
    ]);
    expect(Object.keys(r)).toEqual(["analyze"]);
  });
});
