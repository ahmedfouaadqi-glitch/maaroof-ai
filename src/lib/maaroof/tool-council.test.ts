import { describe, it, expect } from "vitest";
import { summarizeCouncil, ENGINE_COUNCIL_MODELS } from "./tool-council";

describe("tool council", () => {
  it("asks all ten engines", () => expect(ENGINE_COUNCIL_MODELS.length).toBe(10));
  it("silent engines do not count as agreement", () => {
    const s = summarizeCouncil([
      { engine: "chatgpt", status: "answered", agree: true, score: 80, note: "" },
      { engine: "gemini", status: "no_answer", reason: "timeout" },
    ]);
    expect(s.answered).toBe(1);
    expect(s.decision).toBe("agree");
    expect(s.avgScore).toBe(80);
  });
  it("no answers means no evidence", () => expect(summarizeCouncil([{ engine: "x", status: "no_answer", reason: "error" }]).decision).toBe("no_evidence"));
  it("majority disagree", () => {
    const s = summarizeCouncil([
      { engine: "a", status: "answered", agree: false, score: 20, note: "" },
      { engine: "b", status: "answered", agree: false, score: 30, note: "" },
      { engine: "c", status: "answered", agree: true, score: 70, note: "" },
    ]);
    expect(s.decision).toBe("disagree");
  });
});
