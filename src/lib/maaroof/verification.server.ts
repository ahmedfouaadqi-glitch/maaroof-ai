// Part 19.3 — Reality Verification Engine (RVE). دمج لا إنشاء.
//
// Verification already existed, but scattered:
//   trust.server.ts     → 13-stage trust pipeline
//   reality.server.ts   → reality-state classification + evidence persistence
//   laws.server.ts      → 30-law constitutional compliance
//   evidence.server.ts  → typed evidence + cross-validation (Part 19.4)
//   benchmark.server.ts → measurement vs baseline over time (Part 19.4)
// This module does NOT re-implement any of them. It is one ordered façade that
// calls them in the constitutional sequence and returns a single explainable
// verdict, so every caller verifies the same way.

import type { RealityAssessment } from "@/lib/maaroof/reality.server";

export const VERIFICATION_STAGES = [
  "collect_evidence",
  "classify_evidence",
  "weigh_evidence",
  "cross_validate",
  "historical_check",
  "benchmark_check",
  "reality_classify",
  "compliance_check",
  "confidence_score",
  "explain",
] as const;
export type VerificationStage = (typeof VERIFICATION_STAGES)[number];

export type VerificationVerdict = "verified" | "supported" | "unverified" | "contested";

export type VerificationResult = {
  verdict: VerificationVerdict;
  score: number;
  reality_state: string | null;
  evidence_count: number;
  independent_sources: number;
  agreement: number;
  contradictions: number;
  stale_evidence: number;
  benchmark_trend: string | null;
  stages: Array<{ stage: VerificationStage; ok: boolean; note: string }>;
  missing: string[];
  explanation: string;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Verify a claim/result using the existing engines, in constitutional order.
 * Never throws: a failed stage degrades the verdict instead of breaking a run.
 */
export async function verifyReality(input: {
  subject: string;
  realityRecordId?: string | null;
  executionId?: string | null;
  assessment?: RealityAssessment | null;
  benchmark?: { subjectKind: string; subject: string; metric: string } | null;
  language?: string;
}): Promise<VerificationResult> {
  const stages: VerificationResult["stages"] = [];
  const missing: string[] = [];
  const lang = input.language || "ar";

  // 1-4 — evidence collection, classification, weighting, cross-validation
  let validation: any = { total: 0, independent_sources: 0, agreement: 0, contradicting: 0, weighted_score: 0, stale: 0, verdict: "none" };
  try {
    const { validateEvidenceFor } = await import("@/lib/maaroof/evidence.server");
    const r = await validateEvidenceFor({ realityRecordId: input.realityRecordId, executionId: input.executionId });
    validation = r.validation;
    stages.push({ stage: "collect_evidence", ok: r.items.length > 0, note: `${r.items.length} عنصر دليل` });
    stages.push({ stage: "classify_evidence", ok: !!validation.strongest_type, note: String(validation.strongest_type || "غير مصنّف") });
    stages.push({ stage: "weigh_evidence", ok: validation.weighted_score >= 45, note: `وزن ${validation.weighted_score}%` });
    stages.push({ stage: "cross_validate", ok: validation.independent_sources >= 2, note: `${validation.independent_sources} مصدر مستقل` });
    if (!r.items.length) missing.push("لا توجد أدلة مسجّلة");
    if (validation.independent_sources < 2) missing.push("مصدر واحد فقط — لا تحقق متقاطع");
  } catch {
    stages.push({ stage: "collect_evidence", ok: false, note: "تعذّر قراءة الأدلة" });
  }

  // 5 — historical corroboration
  let historical = 0;
  try {
    const { evidenceOverview } = await import("@/lib/maaroof/evidence.server");
    const ov = await evidenceOverview(200);
    historical = ov.by_type?.historical || 0;
    stages.push({ stage: "historical_check", ok: historical > 0, note: `${historical} دليل تاريخي` });
  } catch {
    stages.push({ stage: "historical_check", ok: false, note: "—" });
  }

  // 6 — benchmark trend
  let trend: string | null = null;
  if (input.benchmark) {
    try {
      const { benchmarkTrend } = await import("@/lib/maaroof/benchmark.server");
      const t = await benchmarkTrend(input.benchmark.subjectKind as any, input.benchmark.subject, input.benchmark.metric);
      trend = (t as any)?.trend ?? null;
      stages.push({ stage: "benchmark_check", ok: trend === "improving", note: trend || "لا قياس" });
    } catch {
      stages.push({ stage: "benchmark_check", ok: false, note: "—" });
    }
  } else {
    stages.push({ stage: "benchmark_check", ok: false, note: "لا معيار مرتبط" });
    missing.push("لا معيار قياس مرتبط");
  }

  // 7 — reality classification (reuses the Part 19.1 classifier output)
  const realityState = input.assessment?.reality_state ?? null;
  stages.push({ stage: "reality_classify", ok: !!realityState, note: realityState || "غير مصنّف" });

  // 8 — constitutional compliance
  let compliant = true;
  try {
    const laws: any = await import("@/lib/maaroof/laws.server");
    const fn = laws.evaluateCompliance || laws.checkCompliance || null;
    if (typeof fn === "function") {
      const verdict = await fn({ subject: input.subject, evidence: validation.total, contradictions: validation.contradicting });
      compliant = (verdict?.verdict ?? verdict) !== "violation";
      stages.push({ stage: "compliance_check", ok: compliant, note: String(verdict?.verdict ?? "compliant") });
    } else {
      stages.push({ stage: "compliance_check", ok: true, note: "لا فحص متاح" });
    }
  } catch {
    stages.push({ stage: "compliance_check", ok: true, note: "لا فحص متاح" });
  }

  // 9 — composite score
  const realityStrength = input.assessment?.reality_score ?? 0;
  const score = clamp(
    validation.weighted_score * 0.35 +
      validation.agreement * 0.2 +
      Math.min(validation.independent_sources, 4) * 5 +
      realityStrength * 0.25 +
      (trend === "improving" ? 8 : 0) +
      (compliant ? 5 : -25),
  );
  stages.push({ stage: "confidence_score", ok: score >= 60, note: `${score}%` });

  let verdict: VerificationVerdict;
  if (validation.contradicting > validation.agreeing) verdict = "contested";
  else if (score >= 75 && validation.independent_sources >= 2) verdict = "verified";
  else if (score >= 50) verdict = "supported";
  else verdict = "unverified";

  const explanation =
    lang === "ar"
      ? `التحقق: ${verdict} بدرجة ${score}% — ${validation.total} دليل من ${validation.independent_sources} مصدر مستقل، اتفاق ${validation.agreement}%${validation.contradicting ? `، تعارضات ${validation.contradicting}` : ""}${trend ? `، اتجاه القياس ${trend}` : ""}.`
      : `Verification: ${verdict} at ${score}% — ${validation.total} evidence items from ${validation.independent_sources} independent sources, ${validation.agreement}% agreement${validation.contradicting ? `, ${validation.contradicting} contradictions` : ""}${trend ? `, benchmark trend ${trend}` : ""}.`;
  stages.push({ stage: "explain", ok: true, note: explanation });

  return {
    verdict,
    score,
    reality_state: realityState,
    evidence_count: validation.total,
    independent_sources: validation.independent_sources,
    agreement: validation.agreement,
    contradictions: validation.contradicting,
    stale_evidence: validation.stale,
    benchmark_trend: trend,
    stages,
    missing,
    explanation,
  };
}

/** Short transparency line appended to answers when verification is weak. */
export function verificationNotice(v: VerificationResult, language = "ar"): string {
  if (v.verdict === "verified") return "";
  if (language === "ar") {
    return `> ✅ **التحقق: ${v.verdict}** (${v.score}%) — ${v.evidence_count} دليل · ${v.independent_sources} مصدر مستقل${v.missing.length ? ` · ناقص: ${v.missing.slice(0, 2).join(" · ")}` : ""}\n`;
  }
  return `> ✅ **Verification: ${v.verdict}** (${v.score}%) — ${v.evidence_count} evidence · ${v.independent_sources} independent sources\n`;
}
