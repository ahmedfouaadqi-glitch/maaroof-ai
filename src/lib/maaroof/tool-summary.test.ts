import { describe, expect, it } from "vitest";
import { extractToolSummary } from "./tool-summary";

describe("extractToolSummary", () => {
  it("reads nested comparison and strategy summaries", () => {
    expect(extractToolSummary({ result: { comparison: { summary: "Brand A leads on visibility." } } }))
      .toBe("Brand A leads on visibility.");
    expect(extractToolSummary({ data: { executive_summary: "Prioritize entity consistency." } }))
      .toBe("Prioritize entity consistency.");
  });

  it("summarizes section arrays and bounds output", () => {
    expect(extractToolSummary({ sections: [{ title: "Findings" }, { summary: "Improve citations" }] }))
      .toBe("Findings — Improve citations");
    expect(extractToolSummary({ summary: "x".repeat(100) }, 20)).toHaveLength(20);
  });

  it("returns null for empty or non-readable payloads", () => {
    expect(extractToolSummary({ ok: true, count: 3 })).toBeNull();
    expect(extractToolSummary("   ")).toBeNull();
  });
});
