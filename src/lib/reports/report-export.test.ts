import { describe, expect, it } from "vitest";
import { buildExecutiveExportPayload, buildTechnicalExportPayload } from "./report-export";
import { projectExecutiveReport, validateAuditReportSnapshot } from "./report-contract";

const input = {
  schemaVersion: 1 as const, reportId: "r-1", version: 1, workspaceId: null,
  title: "Audit", generatedAt: "2026-11-17T10:00:00Z",
  clientIdentity: { name: "Acme", language: "ar" as const },
  auditRun: { runId: "run-1", startedAt: "2026-11-17T09:00:00Z", completedAt: null, status: "partial" as const, methodology: ["Source review"] },
  evidence: [{ id: "e-1", sourceType: "tool" as const, sourceLabel: "Visibility tool", collectedAt: "2026-11-17T09:30:00Z", state: "observed" as const, excerpt: "private technical excerpt", notes: ["internal note"] }],
  findings: [{ id: "f-1", title: "Missing citation", summary: "Citation coverage is incomplete.", severity: "medium" as const, confidence: 0.7, status: "open" as const, evidenceIds: ["e-1"] }],
  recommendations: [{ id: "rec-1", title: "Add cited sources", rationale: "Support important claims.", priority: "high" as const, status: "proposed" as const, actionSteps: ["Map claims"], evidenceIds: ["e-1"] }],
  metrics: [{ id: "m-1", label: "Citation coverage", value: null, state: "unknown" as const, evidenceIds: [] }],
  limitations: ["One provider was unavailable."],
};

describe("report export projections", () => {
  it("builds a client payload without technical evidence excerpts", () => {
    const valid = validateAuditReportSnapshot(input);
    if (!valid.success) throw new Error(valid.errors.join(","));
    const payload = buildExecutiveExportPayload(projectExecutiveReport(valid.data), "ar");
    expect(payload.sections.some((s) => s.heading === "النتائج الرئيسية")).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("private technical excerpt");
    expect(JSON.stringify(payload)).not.toContain("internal note");
  });

  it("builds a technical payload with traceable evidence and findings", () => {
    const valid = validateAuditReportSnapshot(input);
    if (!valid.success) throw new Error(valid.errors.join(","));
    const payload = buildTechnicalExportPayload(valid.data, "en");
    expect(payload.sections.some((s) => s.heading === "Evidence Register")).toBe(true);
    expect(JSON.stringify(payload)).toContain("private technical excerpt");
    expect(JSON.stringify(payload)).toContain("e-1");
  });
});
