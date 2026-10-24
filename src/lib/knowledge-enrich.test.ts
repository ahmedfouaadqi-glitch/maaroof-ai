import { describe, it, expect } from "vitest";
import { formatFacts } from "./knowledge-enrich.server";
describe("formatFacts", () => {
  it("formats and fails safe", () => {
    expect(formatFacts(null as any)).toBe("");
    expect(formatFacts([{ title: "A", description: "b  c", url: "https://x" }])).toBe("- A: b c (https://x)");
  });
});
