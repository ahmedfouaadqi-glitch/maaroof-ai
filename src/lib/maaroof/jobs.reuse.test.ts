import { describe, expect, it } from "vitest";
import { reusableResultKey, reusableResults } from "./jobs";

describe("resumable tool results", () => {
  it("reuses only the exact successful tool input", () => {
    const signature = reusableResultKey("analyze", { site: "https://a.example", depth: 2 });
    const reused = reusableResults([{ tool: "analyze", ok: true, input_signature: signature, output: { finding: "saved" } }]);
    expect(reused[signature]).toEqual({ finding: "saved" });
    expect(reused.analyze).toBeUndefined();
    expect(reused[reusableResultKey("analyze", { site: "https://b.example", depth: 2 })]).toBeUndefined();
  });
  it("does not reuse ambiguous legacy results for a repeated tool", () => {
    const reused = reusableResults([
      { tool: "analyze", ok: true, output: { finding: "old input" } },
      { tool: "analyze", ok: true, output: { finding: "different input" } },
    ]);
    expect(reused.analyze).toBeUndefined();
  });
  it("never falls back to legacy results when signed outputs for that tool exist", () => {
    const signature = reusableResultKey("analyze", { site: "https://a.example" });
    const reused = reusableResults([
      { tool: "analyze", ok: true, output: { finding: "legacy, different input" } },
      { tool: "analyze", ok: true, input_signature: signature, output: { finding: "signed input" } },
    ]);
    expect(reused[signature]).toEqual({ finding: "signed input" });
    expect(reused.analyze).toBeUndefined();
  });
  it("ignores failures, skipped outputs, and needs-input results", () => {
    const reused = reusableResults([
      { tool: "analyze", ok: false, output: { error: "timeout" } },
      { tool: "compare", ok: true, output: { skipped: "no_competitors_found" } },
      { tool: "research", ok: true, output: { needs_input: ["site"] } },
    ]);
    expect(reused).toEqual({});
  });
  it("canonicalizes object key order for stable signatures", () => {
    expect(reusableResultKey("compare", { a: 1, b: { x: 2, y: 3 } }))
      .toBe(reusableResultKey("compare", { b: { y: 3, x: 2 }, a: 1 }));
  });
});
