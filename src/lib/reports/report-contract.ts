import { z } from "zod";

export const EVIDENCE_STATES = ["verified", "measured", "observed", "estimated", "unknown"] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

const EvidenceSchema = z.object({
  id: z.string().min(1),
  sourceType: z.enum(["url", "tool", "test", "document", "manual", "dataset"]),
  sourceLabel: z.string().min(1),
  uri: z.string().url().optional(),
  collectedAt: z.string().min(1),
  state: z.enum(EVIDENCE_STATES),
  excerpt: z.string().max(12000).optional(),
  notes: z.array(z.string().max(2000)).default([]),
});

const FindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  summary: z.string().max(6000),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  confidence: z.number().min(0).max(1),
  status: z.enum(["open", "in_progress", "resolved", "accepted", "unknown"]),
  evidenceIds: z.array(z.string().min(1)).min(1),
});

const RecommendationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  rationale: z.string().max(6000),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["proposed", "approved", "in_progress", "completed", "blocked"]),
  actionSteps: z.array(z.string().max(2000)).default([]),
  evidenceIds: z.array(z.string().min(1)).min(1),
});

const MetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(300),
  value: z.union([z.number().finite(), z.string().max(500), z.null()]),
  unit: z.string().max(80).optional(),
  state: z.enum(EVIDENCE_STATES),
  evidenceIds: z.array(z.string().min(1)).default([]),
});

export const AuditReportSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  reportId: z.string().min(1),
  version: z.number().int().positive(),
  workspaceId: z.string().uuid().nullable(),
  title: z.string().min(1).max(300),
  generatedAt: z.string().min(1),
  clientIdentity: z.object({
    name: z.string().min(1).max(200),
    website: z.string().url().nullable().optional(),
    industry: z.string().max(200).optional(),
    language: z.enum(["ar", "en", "ku"]),
  }),
  auditRun: z.object({
    runId: z.string().min(1),
    startedAt: z.string().min(1),
    completedAt: z.string().min(1).nullable(),
    status: z.enum(["completed", "partial", "failed", "unknown"]),
    methodology: z.array(z.string().max(2000)).default([]),
  }),
  evidence: z.array(EvidenceSchema),
  findings: z.array(FindingSchema),
  recommendations: z.array(RecommendationSchema),
  metrics: z.array(MetricSchema),
  limitations: z.array(z.string().max(3000)).default([]),
});
export type AuditReportSnapshot = z.infer<typeof AuditReportSnapshotSchema>;

export type ReportValidation = { success: true; data: AuditReportSnapshot } | { success: false; errors: string[] };

export function validateAuditReportSnapshot(input: unknown): ReportValidation {
  const parsed = AuditReportSnapshotSchema.safeParse(input);
  if (!parsed.success) return { success: false, errors: parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message) };

  const evidenceIds = new Set(parsed.data.evidence.map((item) => item.id));
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed.data.evidence) {
    if (seen.has(item.id)) errors.push("duplicate_evidence_id:" + item.id);
    seen.add(item.id);
  }
  const checkRefs = (kind: string, id: string, refs: string[]) => {
    for (const ref of refs) if (!evidenceIds.has(ref)) errors.push("missing_evidence:" + kind + ":" + id + ":" + ref);
  };
  for (const finding of parsed.data.findings) checkRefs("finding", finding.id, finding.evidenceIds);
  for (const recommendation of parsed.data.recommendations) checkRefs("recommendation", recommendation.id, recommendation.evidenceIds);
  for (const metric of parsed.data.metrics) checkRefs("metric", metric.id, metric.evidenceIds);
  return errors.length ? { success: false, errors } : { success: true, data: parsed.data };
}

export type ExecutiveReportProjection = {
  reportId: string;
  version: number;
  title: string;
  generatedAt: string;
  client: AuditReportSnapshot["clientIdentity"];
  runStatus: AuditReportSnapshot["auditRun"]["status"];
  methodology: string[];
  metrics: Array<Pick<AuditReportSnapshot["metrics"][number], "id" | "label" | "value" | "unit" | "state">>;
  findings: Array<Pick<AuditReportSnapshot["findings"][number], "id" | "title" | "summary" | "severity" | "status">>;
  recommendations: Array<Pick<AuditReportSnapshot["recommendations"][number], "id" | "title" | "rationale" | "priority" | "status" | "actionSteps">>;
  sourceSummary: Array<{ label: string; collectedAt: string; state: EvidenceState }>;
  limitations: string[];
};

export function projectExecutiveReport(snapshot: AuditReportSnapshot): ExecutiveReportProjection {
  const referenced = new Set([
    ...snapshot.findings.flatMap((item) => item.evidenceIds),
    ...snapshot.recommendations.flatMap((item) => item.evidenceIds),
    ...snapshot.metrics.flatMap((item) => item.evidenceIds),
  ]);
  return {
    reportId: snapshot.reportId,
    version: snapshot.version,
    title: snapshot.title,
    generatedAt: snapshot.generatedAt,
    client: snapshot.clientIdentity,
    runStatus: snapshot.auditRun.status,
    methodology: [...snapshot.auditRun.methodology],
    metrics: snapshot.metrics.map(({ id, label, value, unit, state }) => ({ id, label, value, unit, state })),
    findings: snapshot.findings.map(({ id, title, summary, severity, status }) => ({ id, title, summary, severity, status })),
    recommendations: snapshot.recommendations.map(({ id, title, rationale, priority, status, actionSteps }) => ({ id, title, rationale, priority, status, actionSteps })),
    sourceSummary: snapshot.evidence.filter((item) => referenced.has(item.id)).map(({ sourceLabel, collectedAt, state }) => ({ label: sourceLabel, collectedAt, state })),
    limitations: [...snapshot.limitations],
  };
}

export function projectTechnicalReport(snapshot: AuditReportSnapshot): AuditReportSnapshot {
  return {
    ...snapshot,
    evidence: snapshot.evidence.map((item) => ({ ...item, notes: [...item.notes] })),
    findings: snapshot.findings.map((item) => ({ ...item, evidenceIds: [...item.evidenceIds] })),
    recommendations: snapshot.recommendations.map((item) => ({ ...item, actionSteps: [...item.actionSteps], evidenceIds: [...item.evidenceIds] })),
    metrics: snapshot.metrics.map((item) => ({ ...item, evidenceIds: [...item.evidenceIds] })),
    limitations: [...snapshot.limitations],
    auditRun: { ...snapshot.auditRun, methodology: [...snapshot.auditRun.methodology] },
  };
}
