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

import { parseVerdict, withFallback } from "./tool-council";
describe("council fallback", () => {
  it("uses the gateway when OpenRouter fails for that engine", async () => {
    const v = await withFallback("grok", async () => ({ engine: "grok", status: "no_answer", reason: "http_402" }), async () => ({ engine: "grok", status: "answered", agree: true, score: 70, note: "" }));
    expect(v.status).toBe("answered");
    expect(v.via).toBe("gateway");
  });
  it("stays no_answer when both routes fail", async () => {
    const v = await withFallback("claude", async () => { throw new Error("x"); }, async () => ({ engine: "claude", status: "no_answer", reason: "timeout" }));
    expect(v.status).toBe("no_answer");
  });
  it("parses a valid verdict and rejects junk", () => {
    expect(parseVerdict("qwen", 'ok {"agree":false,"score":140,"note":"n"}')).toMatchObject({ score: 100, agree: false });
    expect(parseVerdict("qwen", "no json")).toBeNull();
  });
});
