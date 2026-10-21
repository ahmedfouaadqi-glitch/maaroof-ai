import { describe, it, expect } from "vitest";
import { summarizeLedger, knowledgeCompletion } from "./workspace-panels";

describe("summarizeLedger", () => {
  it("counts only this month's real charges for monthly usage", () => {
    const s = summarizeLedger([
      { tokens: 20, tool_key: "a", created_at: "2026-10-05T00:00:00Z" },
      { tokens: 30, tool_key: "b", created_at: "2026-10-20T00:00:00Z" },
      { tokens: 100, tool_key: "a", created_at: "2026-09-20T00:00:00Z" },
    ], new Date("2026-10-21T00:00:00Z"));
    expect(s.month).toBe(50);
    expect(s.total).toBe(150);
    expect(s.top[0]).toEqual({ tool: "a", tokens: 120 });
  });
});

describe("knowledgeCompletion", () => {
  it("is 0 with no answers and no facts", () => expect(knowledgeCompletion(0, 0, 0)).toBe(0));
  it("is 100 when all questions answered and 20+ facts saved", () => expect(knowledgeCompletion(5, 5, 25)).toBe(100));
  it("half answered with no facts gives 30", () => expect(knowledgeCompletion(2, 4, 0)).toBe(30));
});
