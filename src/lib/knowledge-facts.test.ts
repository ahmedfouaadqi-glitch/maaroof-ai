import { describe, it, expect } from "vitest";
import { taskFact, freshFacts, factsContextLine, interviewFacts } from "./knowledge-facts";

describe("knowledge facts", () => {
  it("task facts expire after 30 days", () => {
    const now = Date.UTC(2026, 0, 1);
    const f = taskFact("قياس الظهور", "النتيجة: العلامة ظهرت في 4 من 10 نماذج", now)!;
    expect(new Date(f.expires_at).getTime() - now).toBe(30 * 86400000);
  });
  it("no fact from an empty result", () => {
    expect(taskFact("goal", "short")).toBeNull();
  });
  it("drops expired facts", () => {
    const now = Date.now();
    expect(freshFacts([{ expires_at: new Date(now - 1).toISOString() }, { expires_at: null }], now)).toHaveLength(1);
  });
  it("context line is empty with no facts", () => {
    expect(factsContextLine([])).toBe("");
  });
  it("only answered interview questions become facts", () => {
    expect(interviewFacts([{ question: "q1", answer: "a", created_at: "x" }, { question: "q2", answer: null, created_at: "x" }])).toHaveLength(1);
  });
});

import { ownerIdentity } from "./knowledge-facts";
describe("ownerIdentity", () => {
  it("counts only filled fields and never invents", () => {
    const r = ownerIdentity({ full_name: "Ahmed", brand_name: " ", account_kind: "marketing_company", target_markets: [], entity_links: { site: "https://x.com" } });
    expect(r.known).toEqual(["full_name", "account_kind", "entity_links"]);
    expect(r.completeness).toBe(43);
    expect(r.verified).toBe(false);
  });
  it("empty profile is 0%", () => { expect(ownerIdentity(null).completeness).toBe(0); });
});
