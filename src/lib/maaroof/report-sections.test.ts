import { describe, it, expect } from "vitest";
import { buildSessionSections, directAnswer, flattenValue } from "./report-sections";

const events = [
  { type: "tool_call", data: { index: 0, tool: "visibility", reason: "check", input: { brand: "X" } } },
  { type: "tool_result", data: { index: 0, ok: true, output: { summary: "Brand appears in 3 of 10 engines.", rows: [{ a: 1, b: { c: 2 } }], mci: { reused: true } } } },
  { type: "tool_call", data: { index: 1, tool: "research", reason: "r", input: {} } },
  { type: "tool_result", data: { index: 1, ok: false, output: { error: "x" } } },
];

describe("report-sections", () => {
  it("flattens JSON strings to readable text", () => {
    expect(flattenValue('{"a":1,"b":[1,2]}')).not.toMatch(/[{}[\]]/);
  });
  it("picks a direct answer", () => {
    expect(directAnswer({ summary: "Brand appears in 3 of 10 engines." })).toContain("3 of 10");
  });
  it("produces no raw JSON in sections", () => {
    const s = buildSessionSections({ events, lang: "en", goal: "g", finalText: "done" });
    expect(JSON.stringify(s)).not.toMatch(/\[object|\\"mci\\"/);
    for (const x of s) if (x.text) expect(x.text).not.toMatch(/[{}]/);
  });
  it("supports selecting one step", () => {
    const s = buildSessionSections({ events, lang: "en", goal: "g", selection: { steps: [0] } });
    expect(s.some((x) => (x.heading || "").includes("2."))).toBe(false);
  });
});
