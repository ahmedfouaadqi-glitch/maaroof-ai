// Part 19 — Reality Execution & Verification Constitution (foundation layer).
//
// EVOLUTION, NOT CREATION. Every signal used here is already produced by the
// existing engines:
//   - trust.server.ts      → 13-stage pipeline + per-entity trust profiles
//   - knowledge.server.ts  → 9-layer graph with confidence/reliability/freshness
//   - decisions.server.ts  → 20-stage decision traces
//   - laws.server.ts       → 30-law compliance verdict
//   - orchestrator         → tool results, memories, envision, timing, mode
// None of those are rewritten or replaced. This module adds the ONE missing
// seam: classifying a run's output into an explicit *Reality State*, scoring
// evidence/verification, persisting the evidence behind it, and feeding the
// result back into knowledge + trust so verified outcomes strengthen the graph.
// Fully local arithmetic — zero extra model requests.

import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

/** Constitutional classification vocabulary. Ordered strongest → weakest. */
export const REALITY_STATES = [
  "verified",
  "measured",
  "observed",
  "historical",
  "external",
  "internal",
  "predicted",
  "simulation",
  "experimental",
  "hypothesis",
  "opinion",
  "unknown",
] as const;
export type RealityState = (typeof REALITY_STATES)[number];

/** Strength ranking used for gates ("weaker than measured" etc.). */
export const REALITY_STRENGTH: Record<RealityState, number> = {
  verified: 100,
  measured: 85,
  observed: 70,
  historical: 60,
  external: 55,
  internal: 50,
  predicted: 40,
  simulation: 35,
  experimental: 30,
  hypothesis: 20,
  opinion: 10,
  unknown: 0,
};

/** The permanent Reality Loop — every engine stamps the stage it reached. */
export const REALITY_LOOP = [
  "observation",
  "understanding",
  "planning",
  "execution",
  "measurement",
  "verification",
  "evidence_collection",
  "reality_validation",
  "knowledge_update",
  "trust_update",
  "memory_update",
  "expert_update",
  "subagent_update",
  "hermes_report",
  "founder_decision",
  "continuous_improvement",
] as const;
export type RealityLoopStage = (typeof REALITY_LOOP)[number];

export const REALITY_STATE_LABELS: Record<RealityState, { ar: string; en: string; ku: string }> = {
  verified: { ar: "مُتحقَّق", en: "Verified", ku: "پشتڕاستکراو" },
  measured: { ar: "مُقاس", en: "Measured", ku: "پێواوکراو" },
  observed: { ar: "مُلاحَظ", en: "Observed", ku: "چاودێریکراو" },
  historical: { ar: "تاريخي", en: "Historical", ku: "مێژوویی" },
  external: { ar: "مصدر خارجي", en: "External", ku: "دەرەکی" },
  internal: { ar: "مصدر داخلي", en: "Internal", ku: "ناوەکی" },
  predicted: { ar: "متوقَّع", en: "Predicted", ku: "پێشبینیکراو" },
  simulation: { ar: "محاكاة", en: "Simulation", ku: "شێوەکاری" },
  experimental: { ar: "تجريبي", en: "Experimental", ku: "تاقیکاری" },
  hypothesis: { ar: "فرضية", en: "Hypothesis", ku: "گریمانە" },
  opinion: { ar: "رأي", en: "Opinion", ku: "بۆچوون" },
  unknown: { ar: "غير معروف", en: "Unknown", ku: "نەزانراو" },
};

export type EvidenceSourceKind =
  | "tool_result"
  | "memory"
  | "knowledge_node"
  | "measurement"
  | "execution"
  | "external"
  | "internal";

export type EvidenceItem = {
  source_kind: EvidenceSourceKind;
  source_ref?: string | null;
  claim?: string | null;
  weight?: number;
  success_count?: number;
  reproducible?: boolean;
  contradicts?: any[];
  verified_by?: string | null;
  verified_at?: string | null;
};

export type RealitySignals = {
  /** Tool executions already performed by the run. */
  toolResults: Array<{ tool: string; ok: boolean }>;
  memoriesRecalled: number;
  knowledgeNodes: number;
  councilOpinions: number;
  councilAvgConfidence: number | null;
  /** Trust envelope / pipeline output from Parts 7 + 15. */
  trustScore: number | null;
  trustRisks: number;
  trustAlternatives: string[];
  hasEnvision: boolean;
  timingVerdict: string | null;
  executionMode: string;
  /** Part 8 verdict: compliant | warning | violation. */
  complianceVerdict: string | null;
  externalSources: number;
  historicalSamples: number;
  finalTextLength: number;
};

export type RealityAssessment = {
  reality_state: RealityState;
  reality_score: number;
  evidence_score: number;
  verification_score: number;
  confidence: number;
  reproducible: boolean;
  loop_stage: RealityLoopStage;
  missing_evidence: string[];
  contradictions: string[];
  alternatives: string[];
  evidence: EvidenceItem[];
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Evidence strength from the artefacts the run actually produced. */
export function evidenceScore(s: RealitySignals): number {
  const ok = s.toolResults.filter((r) => r.ok).length;
  return clamp(
    ok * 18 +
      Math.min(s.knowledgeNodes, 6) * 6 +
      Math.min(s.memoriesRecalled, 6) * 4 +
      Math.min(s.externalSources, 4) * 7 +
      Math.min(s.historicalSamples, 5) * 3,
  );
}

/** Verification strength: independent confirmation + compliance + no failures. */
export function verificationScore(s: RealitySignals): number {
  const total = s.toolResults.length;
  const ok = s.toolResults.filter((r) => r.ok).length;
  const successRate = total ? (ok / total) * 100 : 0;
  const compliance =
    s.complianceVerdict === "compliant" ? 100 : s.complianceVerdict === "warning" ? 60 : s.complianceVerdict ? 15 : 50;
  const council = s.councilAvgConfidence ?? 50;
  const trust = s.trustScore ?? 50;
  return clamp(successRate * 0.35 + compliance * 0.2 + council * 0.2 + trust * 0.25);
}

/**
 * Classify the run's output into a constitutional Reality State.
 * Deterministic and local: identical signals always yield the same state.
 */
export function classifyReality(s: RealitySignals): RealityAssessment {
  const ev = evidenceScore(s);
  const ver = verificationScore(s);
  const ok = s.toolResults.filter((r) => r.ok).length;
  const failed = s.toolResults.filter((r) => !r.ok);
  const executed = s.executionMode === "execution" && ok > 0;
  const reproducible = ok >= 1 && failed.length === 0 && ev >= 40;

  let state: RealityState;
  if (executed && ev >= 60 && ver >= 70 && s.complianceVerdict !== "violation") state = "verified";
  else if (executed && ev >= 40) state = "measured";
  else if (ok > 0) state = "observed";
  else if (s.executionMode === "simulation") state = "simulation";
  else if (s.hasEnvision && s.executionMode === "recommendation") state = "predicted";
  else if (s.externalSources > 0) state = "external";
  else if (s.historicalSamples > 0 || s.memoriesRecalled > 0) state = "historical";
  else if (s.knowledgeNodes > 0) state = "internal";
  else if (s.councilOpinions > 0) state = "hypothesis";
  else if (s.finalTextLength > 0) state = "opinion";
  else state = "unknown";

  const reality_score = clamp(ev * 0.4 + ver * 0.4 + REALITY_STRENGTH[state] * 0.2);
  const confidence = clamp(
    (s.trustScore ?? s.councilAvgConfidence ?? 50) * 0.5 + ver * 0.3 + REALITY_STRENGTH[state] * 0.2,
  );

  const missing_evidence: string[] = [];
  if (ok === 0) missing_evidence.push("لا توجد نتيجة تنفيذ ناجحة تسند الاستنتاج.");
  if (s.knowledgeNodes === 0) missing_evidence.push("لم تُستخدم أي عقدة معرفية موثّقة.");
  if (s.externalSources === 0) missing_evidence.push("لا يوجد مصدر خارجي مستقل للتحقق.");
  if (s.memoriesRecalled === 0) missing_evidence.push("لا توجد سوابق تاريخية مقارنة.");
  if (s.trustScore == null) missing_evidence.push("لم تُحتسب درجة ثقة مقاسة لهذه الإجابة.");

  const contradictions: string[] = failed.map((r) => `فشل تنفيذ الأداة «${r.tool}» يناقض الاستنتاج.`);
  if (s.complianceVerdict === "violation") contradictions.push("خرق دستوري مسجَّل في طبقة القوانين.");

  const evidence: EvidenceItem[] = [
    ...s.toolResults.map<EvidenceItem>((r) => ({
      source_kind: "tool_result",
      source_ref: r.tool,
      claim: r.ok ? `نتيجة ناجحة من الأداة ${r.tool}` : `فشل من الأداة ${r.tool}`,
      weight: r.ok ? 3 : 1,
      success_count: r.ok ? 1 : 0,
      reproducible: r.ok,
      verified_by: "execution_engine",
      verified_at: r.ok ? new Date().toISOString() : null,
    })),
    ...(s.memoriesRecalled
      ? [{ source_kind: "memory" as const, source_ref: "maaroof_memory", claim: `${s.memoriesRecalled} ذاكرة مسترجعة`, weight: 2 }]
      : []),
    ...(s.knowledgeNodes
      ? [{ source_kind: "knowledge_node" as const, source_ref: "knowledge_nodes", claim: `${s.knowledgeNodes} عقدة معرفية`, weight: 2 }]
      : []),
    ...(s.trustScore != null
      ? [{ source_kind: "measurement" as const, source_ref: "trust_pipeline", claim: `درجة ثقة مقاسة ${s.trustScore}`, weight: 2 }]
      : []),
  ];

  const loop_stage: RealityLoopStage =
    state === "verified"
      ? "reality_validation"
      : executed
        ? "measurement"
        : ok > 0
          ? "execution"
          : s.hasEnvision
            ? "planning"
            : "observation";

  return {
    reality_state: state,
    reality_score,
    evidence_score: ev,
    verification_score: ver,
    confidence,
    reproducible,
    loop_stage,
    missing_evidence,
    contradictions,
    alternatives: (s.trustAlternatives || []).slice(0, 5),
    evidence: evidence.slice(0, 40),
  };
}

/** Persist the reality record + its evidence. Never throws into a run. */
export async function persistReality(input: {
  assessment: RealityAssessment;
  runId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  subject?: string;
  subjectRef?: string | null;
  signals?: Record<string, any>;
}): Promise<string | null> {
  const a = input.assessment;
  try {
    const { data, error } = await db()
      .from("reality_records")
      .insert({
        run_id: input.runId ?? null,
        user_id: input.userId ?? null,
        workspace_id: input.workspaceId ?? null,
        subject: input.subject || "answer",
        subject_ref: input.subjectRef ?? null,
        reality_state: a.reality_state,
        reality_score: a.reality_score,
        evidence_score: a.evidence_score,
        verification_score: a.verification_score,
        confidence: a.confidence,
        reproducible: a.reproducible,
        loop_stage: a.loop_stage,
        missing_evidence: a.missing_evidence,
        contradictions: a.contradictions,
        alternatives: a.alternatives,
        signals: input.signals || {},
      })
      .select("id")
      .single();
    if (error || !data?.id) return null;
    const recordId = data.id as string;
    if (a.evidence.length) {
      await db()
        .from("evidence_items")
        .insert(
          a.evidence.map((e) => ({
            reality_record_id: recordId,
            user_id: input.userId ?? null,
            source_kind: e.source_kind,
            source_ref: e.source_ref ?? null,
            claim: e.claim ?? null,
            weight: e.weight ?? 1,
            success_count: e.success_count ?? 0,
            reproducible: !!e.reproducible,
            contradicts: e.contradicts || [],
            verified_by: e.verified_by ?? null,
            verified_at: e.verified_at ?? null,
          })),
        );
    }
    return recordId;
  } catch {
    return null;
  }
}

/** Transparency block prepended when the answer is weaker than `measured`. */
export function realityNotice(a: RealityAssessment, language = "ar"): string {
  const strong = REALITY_STRENGTH[a.reality_state] >= REALITY_STRENGTH.measured;
  if (strong) return "";
  if (language === "ar") {
    const L = REALITY_STATE_LABELS[a.reality_state].ar;
    return [
      `> 🔍 **حالة الواقع: ${L}** — درجة الواقع ${a.reality_score}% · الأدلة ${a.evidence_score}% · التحقق ${a.verification_score}% · الثقة ${a.confidence}%`,
      ...(a.missing_evidence.length ? [`> أدلة ناقصة: ${a.missing_evidence.slice(0, 3).join(" · ")}`] : []),
      ...(a.contradictions.length ? [`> تعارضات: ${a.contradictions.slice(0, 2).join(" · ")}`] : []),
      ...(a.alternatives.length ? [`> بدائل ممكنة: ${a.alternatives.slice(0, 3).join(" · ")}`] : []),
      "",
    ].join("\n");
  }
  const L = REALITY_STATE_LABELS[a.reality_state][language === "ku" ? "ku" : "en"];
  return [
    `> 🔍 **Reality state: ${L}** — reality ${a.reality_score}% · evidence ${a.evidence_score}% · verification ${a.verification_score}% · confidence ${a.confidence}%`,
    ...(a.missing_evidence.length ? [`> Missing evidence: ${a.missing_evidence.slice(0, 3).join(" · ")}`] : []),
    ...(a.contradictions.length ? [`> Contradictions: ${a.contradictions.slice(0, 2).join(" · ")}`] : []),
    "",
  ].join("\n");
}

/** Flag-gated prompt block: the transparency + evidence rules for the model. */
export function realityPromptBlock(language = "ar"): string {
  if (language === "ar") {
    return (
      "\n\n[دستور الواقع — الجزء 19]\n" +
      "لا إجابة بلا حالة واقع صريحة. صنِّف كل استنتاج: مُتحقَّق / مُقاس / مُلاحَظ / متوقَّع / فرضية / رأي.\n" +
      "لكل استنتاج: ما الدليل؟ من أين؟ متى تحقّق؟ كم مرة نجح؟ ما الذي يناقضه؟ هل يمكن تكراره؟\n" +
      "لا تُخفِ عدم اليقين: صرّح بالثقة والأدلة الناقصة والمخاطر والبدائل. القياس أقوى من الافتراض، والتنفيذ أقوى من التخطيط."
    );
  }
  return (
    "\n\n[Reality Constitution — Part 19]\n" +
    "No answer without an explicit reality state: verified / measured / observed / predicted / hypothesis / opinion.\n" +
    "For every conclusion: what evidence, from where, verified when, how many successful executions, what contradicts it, is it reproducible?\n" +
    "Never hide uncertainty — state confidence, missing evidence, risks and alternatives."
  );
}

/** Feed verified reality back into the existing knowledge + trust engines. */
export async function closeRealityLoop(input: {
  assessment: RealityAssessment;
  runId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
}): Promise<void> {
  const a = input.assessment;
  try {
    const { recordTrustEvent } = await import("@/lib/maaroof/trust.server");
    await recordTrustEvent({
      entityType: "architecture",
      entityKey: input.runId ? `reality:run:${input.runId}` : "reality:run",
      ok: REALITY_STRENGTH[a.reality_state] >= REALITY_STRENGTH.measured,
      reason: `reality:${a.reality_state}`,
      runId: input.runId || undefined,
      userId: input.userId || undefined,
      confidence: a.confidence,
      contradiction: a.contradictions.length > 0,
    });
  } catch {
    /* trust update must never break a run */
  }

  if (REALITY_STRENGTH[a.reality_state] < REALITY_STRENGTH.measured) return;
  try {
    const { upsertKnowledgeNode } = await import("@/lib/maaroof/knowledge.server");
    await upsertKnowledgeNode({
      layer: "platform",
      key: `reality:${a.reality_state}:${input.runId || "run"}`,
      title: `نتيجة ${REALITY_STATE_LABELS[a.reality_state].ar}`,
      summary: `درجة واقع ${a.reality_score}% بأدلة ${a.evidence_score}% وتحقق ${a.verification_score}%.`,
      payload: { assessment: a },
      sources: a.evidence.slice(0, 10),
      confidence: a.confidence,
      reliability: a.verification_score,
      importance: a.reality_score,
      scope: input.workspaceId ? "workspace" : "platform",
      userId: input.userId || null,
      workspaceId: input.workspaceId || null,
    });
  } catch {
    /* knowledge update must never break a run */
  }
}

/** Aggregates for the admin Reality Center. */
export async function realityOverview(limit = 200) {
  try {
    const { data } = await db()
      .from("reality_records")
      .select("id, run_id, subject, reality_state, reality_score, evidence_score, verification_score, confidence, loop_stage, missing_evidence, contradictions, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = (data as any[]) || [];
    const byState: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    for (const r of rows) {
      byState[r.reality_state] = (byState[r.reality_state] || 0) + 1;
      byStage[r.loop_stage] = (byStage[r.loop_stage] || 0) + 1;
    }
    const avg = (k: string) =>
      rows.length ? Math.round(rows.reduce((a, r) => a + (Number(r[k]) || 0), 0) / rows.length) : 0;
    const gaps = rows
      .filter((r) => REALITY_STRENGTH[r.reality_state as RealityState] < REALITY_STRENGTH.measured || r.contradictions?.length)
      .slice(0, 20);
    return {
      total: rows.length,
      by_state: byState,
      by_stage: byStage,
      avg_reality: avg("reality_score"),
      avg_evidence: avg("evidence_score"),
      avg_verification: avg("verification_score"),
      avg_confidence: avg("confidence"),
      gaps,
      recent: rows.slice(0, 20),
    };
  } catch {
    return { total: 0, by_state: {}, by_stage: {}, avg_reality: 0, avg_evidence: 0, avg_verification: 0, avg_confidence: 0, gaps: [], recent: [] };
  }
}
