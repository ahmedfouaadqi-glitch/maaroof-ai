import { describe, it, expect } from "vitest";
import { councilFromProbe, notMentionedReason, scrubModelNames, withReasons } from "./model-council";

const A = [
  { engine: "chatgpt", mentioned: true, rank: 1, answer: "X is good", brands: ["X", "Y"] },
  { engine: "gemini", mentioned: false, rank: null, answer: "Try Y", brands: ["Y", "Z"] },
  { engine: "claude", mentioned: false, rank: null, answer: "", brands: [] },
];

describe("model council", () => {
  it("every not-mentioned has a reason", () => {
    for (const a of withReasons(A, "X")) if (!a.mentioned) expect(a.reason).toBeTruthy();
    expect(notMentionedReason(A[0], "X")).toBeNull();
  });
  it("builds agreement/disagreement only from answers", () => {
    const c = councilFromProbe(A, ["chatgpt", "gemini", "claude"], "X");
    expect(c.consensusBrands).toContain("Y");
    expect(c.disagreement).toBeTruthy();
    expect(c.decision).toContain("1/3");
    expect(JSON.stringify(c)).not.toMatch(/[{}]\s*"/);
  });
  it("no answers → no fabricated decision", () => {
    expect(councilFromProbe([], ["chatgpt"], "X").answered).toBe(0);
  });
  it("scrubs model versions and proxy wording", () => {
    const s = scrubModelNames("google/gemini-2.5-flash and gpt-5-mini via proxy, Qwen عبر بروكسي");
    expect(s).not.toMatch(/2\.5|gpt-5|proxy|بروكسي|google\//i);
    expect(s).toContain("Gemini");
    expect(s).toContain("ChatGPT");
  });
});
