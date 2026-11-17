import type { ExportPayload, ExportSection } from "@/lib/exports";
import type { AuditReportSnapshot, ExecutiveReportProjection, EvidenceState } from "./report-contract";

type Lang = "ar" | "en" | "ku";

const LABELS = {
  ar: {
    client: "العميل", summary: "الملخص التنفيذي", metrics: "المؤشرات", findings: "النتائج الرئيسية",
    recommendations: "التوصيات والأولويات", sources: "ملخص المصادر", methodology: "المنهجية",
    limitations: "القيود", run: "بيانات تنفيذ التدقيق", evidence: "سجل الأدلة",
    severity: "الشدة", confidence: "الثقة", status: "الحالة", priority: "الأولوية",
    value: "القيمة", state: "حالة القياس", source: "المصدر", collected: "تاريخ الجمع",
    uri: "الرابط", excerpt: "المقتطف", notes: "ملاحظات", evidenceIds: "معرفات الأدلة",
    title: "المؤشر", unit: "الوحدة", recommendation: "التوصية", rationale: "المبرر",
    steps: "خطوات التنفيذ", runStatus: "حالة التدقيق", started: "بدأ في", completed: "انتهى في",
    runId: "معرف التنفيذ",
  },
  en: {
    client: "Client", summary: "Executive Summary", metrics: "Key Metrics", findings: "Key Findings",
    recommendations: "Recommendations & Priorities", sources: "Source Summary", methodology: "Methodology",
    limitations: "Limitations", run: "Audit Run Details", evidence: "Evidence Register",
    severity: "Severity", confidence: "Confidence", status: "Status", priority: "Priority",
    value: "Value", state: "Measurement State", source: "Source", collected: "Collected At",
    uri: "URI", excerpt: "Excerpt", notes: "Notes", evidenceIds: "Evidence IDs",
    title: "Metric", unit: "Unit", recommendation: "Recommendation", rationale: "Rationale",
    steps: "Action Steps", runStatus: "Run Status", started: "Started At", completed: "Completed At",
    runId: "Run ID",
  },
  ku: {
    client: "کڕیار", summary: "پوختەی جێبەجێکردن", metrics: "پێوەرە سەرەکییەکان", findings: "دۆزینەوە سەرەکییەکان",
    recommendations: "پێشنیار و ئەولەویەتەکان", sources: "پوختەی سەرچاوەکان", methodology: "میتۆدۆلۆژیا",
    limitations: "سنووردارییەکان", run: "زانیارییەکانی ئەنجامدانی پشکنین", evidence: "تۆماری بەڵگەکان",
    severity: "توندی", confidence: "متمانە", status: "دۆخ", priority: "ئەولەویەت",
    value: "بەها", state: "دۆخی پێوانە", source: "سەرچاوە", collected: "کاتی کۆکردنەوە",
    uri: "بەستەر", excerpt: "دەق", notes: "تێبینی", evidenceIds: "ناسنامەی بەڵگەکان",
    title: "پێوەر", unit: "یەکە", recommendation: "پێشنیار", rationale: "هۆکار",
    steps: "هەنگاوەکانی جێبەجێکردن", runStatus: "دۆخی ئەنجام", started: "دەستی پێکرد", completed: "کۆتایی هات",
    runId: "ناسنامەی ئەنجام",
  },
} as const;

const stateLabel = (state: EvidenceState, lang: Lang) => {
  const map = {
    verified: { ar: "متحقق", en: "Verified", ku: "پشتڕاستکراو" },
    measured: { ar: "مقاس", en: "Measured", ku: "پێوراو" },
    observed: { ar: "مرصود", en: "Observed", ku: "تێبینی‌کراو" },
    estimated: { ar: "تقديري", en: "Estimated", ku: "خەمڵێنراو" },
    unknown: { ar: "غير معروف", en: "Unknown", ku: "نەزانراو" },
  };
  return map[state][lang];
};

const table = (heading: string, columns: string[], data: (string | number)[][]): ExportSection => ({
  heading, kind: "table", table: { columns, data },
});
const list = (heading: string, values: string[]): ExportSection => ({ heading, kind: "list", list: values });

export function buildExecutiveExportPayload(report: ExecutiveReportProjection, lang: Lang): ExportPayload {
  const t = LABELS[lang];
  const sections: ExportSection[] = [
    { heading: t.summary, kind: "text", text: report.findings.length
      ? (lang === "en" ? "This report summarizes the current audit findings, measured indicators and recommended actions for " : lang === "ku" ? "ئەم ڕاپۆرتە دۆزینەوە و پێوەر و هەنگاوە پێشنیارکراوەکانی " : "يلخص هذا التقرير نتائج التدقيق الحالية والمؤشرات والإجراءات الموصى بها لـ ") + report.client.name
      : (lang === "en" ? "No findings were recorded in this audit snapshot." : lang === "ku" ? "هیچ دۆزینەوەیەک لەم پشکنینەدا تۆمار نەکراوە." : "لم تُسجل نتائج في نسخة التدقيق هذه.") },
  ];
  if (report.metrics.length) sections.push(table(t.metrics,
    [t.title, t.value, t.unit, t.state],
    report.metrics.map((item) => [item.label, item.value == null ? "—" : String(item.value), item.unit || "", stateLabel(item.state, lang)]),
  ));
  if (report.findings.length) sections.push(table(t.findings,
    [t.title, t.severity, t.status],
    report.findings.map((item) => [item.title, item.severity, item.status]),
  ));
  if (report.recommendations.length) sections.push(table(t.recommendations,
    [t.recommendation, t.priority, t.status],
    report.recommendations.map((item) => [item.title, item.priority, item.status]),
  ));
  if (report.sourceSummary.length) sections.push(table(t.sources,
    [t.source, t.collected, t.state],
    report.sourceSummary.map((item) => [item.label, item.collectedAt, stateLabel(item.state, lang)]),
  ));
  if (report.methodology.length) sections.push(list(t.methodology, report.methodology));
  if (report.limitations.length) sections.push(list(t.limitations, report.limitations));
  return {
    title: report.title,
    subtitle: report.client.name + (report.client.website ? " · " + report.client.website : ""),
    lang,
    sections,
  };
}

export function buildTechnicalExportPayload(report: AuditReportSnapshot, lang: Lang): ExportPayload {
  const t = LABELS[lang];
  const sections: ExportSection[] = [
    { heading: t.run, kind: "kv", rows: [
      [t.client, report.clientIdentity.name],
      [t.runId, report.auditRun.runId],
      [t.runStatus, report.auditRun.status],
      [t.started, report.auditRun.startedAt],
      [t.completed, report.auditRun.completedAt || "—"],
      ["Report version", report.version],
    ] },
  ];
  if (report.evidence.length) sections.push(table(t.evidence,
    ["ID", t.source, t.collected, t.state, t.uri, t.excerpt, t.notes],
    report.evidence.map((item) => [item.id, item.sourceLabel, item.collectedAt, stateLabel(item.state, lang), item.uri || "", item.excerpt || "", item.notes.join(" | ")]),
  ));
  if (report.findings.length) sections.push(table(t.findings,
    ["ID", t.title, t.severity, t.confidence, t.status, t.evidenceIds],
    report.findings.map((item) => [item.id, item.title, item.severity, item.confidence, item.status, item.evidenceIds.join(", ")]),
  ));
  if (report.recommendations.length) sections.push(table(t.recommendations,
    ["ID", t.recommendation, t.priority, t.status, t.rationale, t.steps, t.evidenceIds],
    report.recommendations.map((item) => [item.id, item.title, item.priority, item.status, item.rationale, item.actionSteps.join(" | "), item.evidenceIds.join(", ")]),
  ));
  if (report.metrics.length) sections.push(table(t.metrics,
    ["ID", t.title, t.value, t.unit, t.state, t.evidenceIds],
    report.metrics.map((item) => [item.id, item.label, item.value == null ? "—" : String(item.value), item.unit || "", stateLabel(item.state, lang), item.evidenceIds.join(", ")]),
  ));
  if (report.auditRun.methodology.length) sections.push(list(t.methodology, report.auditRun.methodology));
  if (report.limitations.length) sections.push(list(t.limitations, report.limitations));
  return {
    title: report.title + " — Technical",
    subtitle: report.clientIdentity.name + " · " + report.reportId + " · v" + report.version,
    lang,
    sections,
  };
}
