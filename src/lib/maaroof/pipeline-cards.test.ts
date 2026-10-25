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
  it("assigns live visibility probing to the ten-model council and retains exact query statuses", async () => {
    const { councilEngines } = await import("./pipeline-cards");
    const events = [{
      type: "tool_result",
      data: {
        tool: "visibility",
        ok: true,
        output: {
          probe: {
            query: "Which providers are best for this need?",
            blind_query: "Which providers are best for this need?",
            grounded_question_template: "Audit the evidence [model answer]",
            asked: ["chatgpt", "gemini"],
            statuses: {
              chatgpt: { status: "answered", blind_status: "answered", grounded_status: "ok", blind_ms: 420, grounded_ms: 510, blind_query: "Blind Q", grounded_query: "Grounded Q" },
              gemini: { status: "timeout", blind_status: "timeout", blind_ms: 300, blind_query: "Blind Q" },
            },
            answers: [{
              engine: "chatgpt", mentioned: true, rank: 1, answer: "Brand answer",
              blind_query: "Blind Q", grounded_query: "Grounded Q", blind_ms: 420, grounded_ms: 510,
              blind_status: "answered", grounded_status: "ok", brands: ["Brand"], sources: [],
            }],
          },
        },
      },
    }];
    const engines = councilEngines(events, ["chatgpt", "gemini"], false);
    expect(engines[0]).toMatchObject({ status: "answered", blindQuery: "Blind Q", groundedQuery: "Grounded Q", blindMs: 420, groundedMs: 510 });
    expect(engines[1]).toMatchObject({ status: "unresponsive", miss: "timeout", blindQuery: "Blind Q", blindMs: 300 });
  });

  it("startup events alone show understanding as running", () => {
    expect(st(pipelineCards([{ type: "stage", data: { stage: "understand" } }, { type: "skill_choice", data: {} }], true)))
      .toEqual(["running", "waiting", "waiting", "waiting", "waiting", "waiting"]);
  });
  it("failure during startup fails understanding and stops the rest", () => {
    expect(st(pipelineCards([{ type: "stage", data: { stage: "understand" } }, { type: "error", data: {} }], false)))
      .toEqual(["failed", "stopped", "stopped", "stopped", "stopped", "stopped"]);
  });
});
