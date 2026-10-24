import { describe, it, expect } from "vitest";
import { pipelineCards, taskDuration } from "@/lib/maaroof/pipeline-cards";
const ev = [
  { type: "phase", data: { phase: "envision" }, at: 1000 },
  { type: "phase", data: { phase: "planning" }, at: 4000 },
  { type: "tool_result", at: 9000 },
  { type: "final", at: 12000 },
];
describe("pipeline timing", () => {
  it("stage duration runs until next stage starts", () => {
    const c = pipelineCards(ev, false);
    expect(c.find((x) => x.key === "understand")!.durationMs).toBe(3000);
    expect(c.find((x) => x.key === "plan")!.durationMs).toBe(5000);
  });
  it("skipped stage has no time", () => {
    expect(pipelineCards(ev, false).find((x) => x.key === "council")!.durationMs).toBeNull();
  });
  it("total duration for finished and running tasks", () => {
    expect(taskDuration(ev, false)!.durationMs).toBe(11000);
    expect(taskDuration(ev.slice(0, 2), true, 20000)!.durationMs).toBe(19000);
    expect(taskDuration([{ type: "phase" }], true)).toBeNull();
  });
});
