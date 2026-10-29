import { describe, expect, it } from "vitest";
import { buildEvidenceFinalAnswer } from "./finalizer";

describe("evidence finalizer fallback", () => {
  it("summarizes saved successful outputs without inventing a model response", () => {
    const text = buildEvidenceFinalAnswer("Audit Acme", [{ tool: "analyze", ok: true, output: { score: 42, evidence: ["https://acme.example"] } }], "en", "Iraq");
    expect(text).toContain("Evidence-based fallback report");
    expect(text).toContain("analyze");
    expect(text).toContain("42");
    expect(text).toContain("Iraq");
    expect(text).toContain("saved tool outputs");
  });
  it("clearly reports when no successful tool evidence exists", () => {
    const text = buildEvidenceFinalAnswer("Audit Acme", [{ tool: "analyze", ok: false, output: { error: "timeout" } }], "ar", "العراق");
    expect(text).toContain("لم تُسجّل أي أداة ناجحة");
    expect(text).not.toContain("timeout");
  });
  it("bounds oversized tool output", () => {
    const text = buildEvidenceFinalAnswer("Goal", [{ tool: "research", ok: true, output: { text: "x".repeat(5000) } }], "en", "World");
    expect(text.length).toBeLessThan(3000);
    expect(text).toContain("truncated");
  });
});
