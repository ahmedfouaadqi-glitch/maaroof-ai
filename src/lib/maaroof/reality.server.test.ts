import { describe, it, expect } from "vitest";
import { classifyReality, isMeasuredToolResult, hasExternalEvidence } from "./reality.server";

const base = {
  toolResults: [{ tool: "research", ok: true }],
  memoriesRecalled: 0,
  knowledgeNodes: 0,
  councilOpinions: 0,
  councilAvgConfidence: 100,
  trustScore: 100,
  trustRisks: 0,
  trustAlternatives: [],
  hasEnvision: false,
  timingVerdict: null,
  executionMode: "execution",
  complianceVerdict: "compliant",
  externalSources: 0,
  historicalSamples: 0,
  finalTextLength: 100,
};

describe("reality labels require explicit measurement evidence", () => {
  it("does not classify a successful but unmeasured tool run as measured or verified", () => {
    const result = classifyReality(base);
    expect(result.reality_state).toBe("observed");
    expect(result.reproducible).toBe(false);
    expect(result.missing_evidence.some((s) => s.includes("لم تُرجع أي أداة"))).toBe(true);
  });

  it("requires an explicit measurement contract and source evidence for verified state", () => {
    const result = classifyReality({
      ...base,
      toolResults: [
        { tool: "rank", ok: true, measured: true },
        { tool: "mentions", ok: true, measured: true },
        { tool: "citations", ok: true, measured: true },
      ],
      externalSources: 3,
    });
    expect(result.reality_state).toBe("verified");
  });

  it("recognizes explicit measurement contracts only", () => {
    expect(isMeasuredToolResult({ score: 99 })).toBe(false);
    expect(isMeasuredToolResult({ reality_kind: "measurement" })).toBe(true);
    expect(isMeasuredToolResult({ measurement: { status: "measured" } })).toBe(true);
    expect(isMeasuredToolResult({ probe: { measurement: { reality_kind: "measurement" } } })).toBe(true);
    expect(isMeasuredToolResult({ result: { methodology: { reality_kind: "estimate" } } })).toBe(false);
  });

  it("only recognizes cited URLs as external evidence", () => {
    expect(hasExternalEvidence({ answer: "A confident answer" })).toBe(false);
    expect(hasExternalEvidence({ sources: [{ title: "Evidence", url: "https://example.com" }] })).toBe(true);
    expect(hasExternalEvidence({ probe: { evidence: [{ url: "https://example.com" }] } })).toBe(true);
  });
});
