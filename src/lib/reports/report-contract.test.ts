import { describe, expect, it } from "vitest";
import { projectExecutiveReport, projectTechnicalReport, validateAuditReportSnapshot } from "./report-contract";

const snapshot = {
  schemaVersion: 1 as const,
  reportId: "report-1",
  version: 1,
  workspaceId: "11111111-1111-4111-8111-111111111111",
  title: "Client audit",
  generatedAt: "2026-11-17T10:00:00.000Z",
  clientIdentity: { name: "Example Co", website: "https://example.com", language: "en" as const },
  auditRun: { runId: "run-1", startedAt: "2026-11-17T09:00:00.000Z", completedAt: "2026-11-17T09:30:00.000Z", status: "completed" as const, methodology: ["Public-source review"] },
  evidence: [{ id: "ev-1", sourceType: "url" as const, sourceLabel: "Official website", uri: "https://example.com", collectedAt: "2026-11-17T09:10:00.000Z", state: "observed" as const, excerpt: "Internal excerpt", notes: ["Technical note"] }],
  findings: [{ id: "f-1", title: "Entity data gap", summary: "Structured identity is incomplete.", severity: "medium" as const, confidence: 0.8, status: "open" as const, evidenceIds: ["ev-1"] }],
  recommendations: [{ id: "r-1", title: "Improve entity data", rationale: "Improve consistency.", priority: "high" as const, status: "proposed" as const, actionSteps: ["Review schema"], evidenceIds: ["ev-1"] }],
  metrics: [{ id: "m-1", label: "Coverage", value: 60, unit: "%", state: "measured" as const, evidenceIds: ["ev-1"] }],
  limitations: ["One source was unavailable."],
};

describe("unified report contract", () => {
  it("validates references between findings, recommendations, metrics and evidence", () => {
    expect(validateAuditReportSnapshot(snapshot).success).toBe(true);
    const invalid = { ...snapshot, findings: [{ ...snapshot.findings[0], evidenceIds: ["missing"] }] };
    const result = validateAuditReportSnapshot(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.join(" ")).toContain("missing_evidence:finding:f-1:missing");
  });

  it("projects a client edition without raw evidence excerpts or technical notes", () => {
    const valid = validateAuditReportSnapshot(snapshot);
    if (!valid.success) throw new Error(valid.errors.join(","));
    const client = projectExecutiveReport(valid.data);
    expect(client.findings).toHaveLength(1);
    expect(JSON.stringify(client)).not.toContain("Internal excerpt");
    expect(JSON.stringify(client)).not.toContain("Technical note");
    expect(client.sourceSummary[0].label).toBe("Official website");
  });

  it("retains full evidence in the technical projection", () => {
    const valid = validateAuditReportSnapshot(snapshot);
    if (!valid.success) throw new Error(valid.errors.join(","));
    const technical = projectTechnicalReport(valid.data);
    expect(technical.evidence[0].excerpt).toBe("Internal excerpt");
    expect(technical.evidence[0].notes).toContain("Technical note");
  });
});
