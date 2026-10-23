import { describe, it, expect } from "vitest";
import { pipelineCards } from "./pipeline-cards";

const st = (cards: ReturnType<typeof pipelineCards>) => cards.map((c) => c.state);
describe("pipeline cards", () => {
  it("council running after planning while task runs", () => {
    expect(st(pipelineCards([{ type: "phase", data: { phase: "envision" } }, { type: "phase", data: { phase: "planning" } }, { type: "phase", data: { phase: "council" } }], true)))
      .toEqual(["done", "done", "running", "waiting", "waiting", "waiting"]);
  });
  it("finished task marks unseen stages as skipped, not done", () => {
    expect(st(pipelineCards([{ type: "phase", data: { phase: "planning" } }, { type: "final", data: {} }], false)))
      .toEqual(["skipped", "done", "skipped", "skipped", "skipped", "done"]);
  });
  it("error fails the current stage", () => {
    expect(pipelineCards([{ type: "tool_call", data: {} }, { type: "error", data: {} }], false)[4].state).toBe("failed");
  });
  it("counts finished tool results as evidence", () => {
    expect(pipelineCards([{ type: "tool_call" }, { type: "tool_result" }, { type: "tool_result" }], true)[4].count).toBe(2);
  });
});
