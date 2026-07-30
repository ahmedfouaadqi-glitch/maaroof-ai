// Part 15 — Executive Trust Engine.
// Upgrades the Part 7 trust envelope into a standalone, measurable engine:
// every entity (expert, model, MCP, knowledge node, tool, agent, workspace)
// carries a living Trust Profile that changes after every execution.
// All scoring is local arithmetic — no extra model calls, no hidden cost.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db(): any {
  if (_db) return _db;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db;
}

export const TRUST_ENTITY_TYPES = [
  "expert", "model", "mcp", "knowledge", "tool", "agent", "workspace", "memory", "architecture",
] as const;
export type TrustEntityType = (typeof TRUST_ENTITY_TYPES)[number];

/** The 13 stages every claim passes before it becomes an executive recommendation. */
export const TRUST_PIPELINE = [
  "source", "evidence", "reasoning", "knowledge", "expert", "model",
  "execution_history", "historical_performance", "business_context",
  "future_simulation", "risk", "trust_evaluation", "executive_recommendation",
] as const;

export type TrustStageResult = { stage: string; score: number; weight: number; note: string };

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Evaluate the trust pipeline for one run. Pure function over signals already
 * collected by the orchestrator — costs nothing and never blocks execution.
 */
export function evaluateTrustPipeline(signals: {
  sources: number;
  evidence: number;
  reasoningSteps: number;
  knowledgeNodes: number;
  expertConfidence: number | null;
  modelReliability: number | null;
  pastSuccessRate: number | null;
  historicalSamples: number;
  hasBusinessContext: boolean;
  hasFutureSimulation: boolean;
  risks: number;
  contradictions: number;
}): { stages: TrustStageResult[]; score: number; verdict: string; gaps: string[] } {
  const s = signals;
  const stages: TrustStageResult[] = [
    { stage: "source", score: clamp(s.sources * 25), weight: 1, note: `${s.sources} مصدر` },
    { stage: "evidence", score: clamp(s.evidence * 20), weight: 1.5, note: `${s.evidence} دليل` },
    { stage: "reasoning", score: clamp(s.reasoningSteps * 18), weight: 1.2, note: `${s.reasoningSteps} خطوة استدلال` },
    { stage: "knowledge", score: clamp(s.knowledgeNodes * 22), weight: 1, note: `${s.knowledgeNodes} عقدة معرفة` },
    { stage: "expert", score: clamp(s.expertConfidence ?? 50), weight: 1.3, note: "ثقة مجلس الخبراء" },
    { stage: "model", score: clamp(s.modelReliability ?? 60), weight: 1, note: "موثوقية النموذج" },
    { stage: "execution_history", score: clamp(s.pastSuccessRate ?? 50), weight: 1, note: "نجاح التنفيذ السابق" },
    { stage: "historical_performance", score: clamp(Math.min(s.historicalSamples, 20) * 5), weight: 0.8, note: `${s.historicalSamples} تجربة سابقة` },
    { stage: "business_context", score: s.hasBusinessContext ? 85 : 40, weight: 1, note: s.hasBusinessContext ? "سياق أعمال محدَّد" : "بلا سياق أعمال" },
    { stage: "future_simulation", score: s.hasFutureSimulation ? 80 : 45, weight: 0.8, note: s.hasFutureSimulation ? "محاكاة مستقبلية متاحة" : "بلا محاكاة" },
    { stage: "risk", score: clamp(100 - s.risks * 15), weight: 1.2, note: `${s.risks} مخاطرة معلنة` },
    { stage: "trust_evaluation", score: clamp(100 - s.contradictions * 20), weight: 1.5, note: `${s.contradictions} تناقض` },
  ];
  const totalW = stages.reduce((a, x) => a + x.weight, 0);
  const score = clamp(stages.reduce((a, x) => a + x.score * x.weight, 0) / totalW);
  stages.push({
    stage: "executive_recommendation",
    score,
    weight: 0,
    note: score >= 75 ? "توصية تنفيذية" : score >= 55 ? "توصية بتحفّظ" : "مسودة تحتاج تحققاً بشرياً",
  });
  const gaps = stages
    .filter((x) => x.weight > 0 && x.score < 50)
    .map((x) => `${x.stage}: ${x.note}`);
  return {
    stages,
    score,
    verdict: score >= 75 ? "trusted" : score >= 55 ? "conditional" : "needs_human",
    gaps,
  };
}

/** Read a trust profile, creating the default 50/100 row on first sight. */
export async function getTrustProfile(entityType: TrustEntityType, entityKey: string, userId?: string | null) {
  const q = db().from("trust_profiles").select("*").eq("entity_type", entityType).eq("entity_key", entityKey);
  const { data } = userId ? await q.eq("user_id", userId).maybeSingle() : await q.is("user_id", null).maybeSingle();
  return data ?? null;
}

/** Bulk read for the admin rankings — cheap single query per type. */
export async function listTrustProfiles(entityType?: TrustEntityType) {
  let q = db().from("trust_profiles").select("*").order("trust_score", { ascending: false }).limit(200);
  if (entityType) q = q.eq("entity_type", entityType);
  const { data } = await q;
  return ((data as any[]) || []);
}

/**
 * Record an outcome for one entity. Trust moves as an exponential moving
 * average so a single bad run never destroys a long good record, and a single
 * good run never buys full trust.
 */
export async function recordTrustEvent(input: {
  entityType: TrustEntityType;
  entityKey: string;
  ok: boolean;
  reason: string;
  userId?: string | null;
  runId?: string | null;
  confidence?: number | null;
  costUsd?: number | null;
  latencyMs?: number | null;
  contradiction?: boolean;
  evidence?: Record<string, any>;
}) {
  const existing: any = await getTrustProfile(input.entityType, input.entityKey, input.userId ?? null);
  const prev = Number(existing?.trust_score ?? 50);
  const samples = Number(existing?.samples ?? 0) + 1;
  const successes = Number(existing?.successes ?? 0) + (input.ok ? 1 : 0);
  const failures = Number(existing?.failures ?? 0) + (input.ok ? 0 : 1);
  const contradictions = Number(existing?.contradictions ?? 0) + (input.contradiction ? 1 : 0);

  // Observation score: outcome dominates, confidence nudges.
  const observed = input.ok ? 70 + (Number(input.confidence ?? 60) * 0.3) : 25 + (Number(input.confidence ?? 40) * 0.1);
  const alpha = samples <= 3 ? 0.4 : 0.15; // learn fast at first, stabilise later
  const next = clamp(prev * (1 - alpha) + observed * alpha);

  const avg = (oldV: any, n: number, add: number | null | undefined) =>
    add == null ? (oldV ?? null) : Number((((Number(oldV ?? add) * (n - 1)) + add) / n).toFixed(4));

  const history = Array.isArray(existing?.history) ? existing.history.slice(-29) : [];
  history.push({ at: new Date().toISOString(), score: next, ok: input.ok });

  const row = {
    entity_type: input.entityType,
    entity_key: input.entityKey,
    scope: input.userId ? "user" : "global",
    user_id: input.userId ?? null,
    trust_score: next,
    samples,
    successes,
    failures,
    contradictions,
    avg_confidence: avg(existing?.avg_confidence, samples, input.confidence ?? null),
    avg_cost_usd: avg(existing?.avg_cost_usd, samples, input.costUsd ?? null),
    avg_latency_ms: input.latencyMs == null ? (existing?.avg_latency_ms ?? null)
      : Math.round(Number(avg(existing?.avg_latency_ms, samples, input.latencyMs) ?? input.latencyMs)),
    prediction_accuracy: samples ? Math.round((successes / samples) * 100) : null,
    dimensions: {
      reliability: samples ? Math.round((successes / samples) * 100) : 50,
      consistency: clamp(100 - contradictions * 12),
      cost_efficiency: existing?.avg_cost_usd ? clamp(100 - Number(existing.avg_cost_usd) * 2000) : null,
      responsiveness: existing?.avg_latency_ms ? clamp(100 - Number(existing.avg_latency_ms) / 200) : null,
    },
    history,
    last_evaluated_at: new Date().toISOString(),
  };

  if (existing?.id) await db().from("trust_profiles").update(row).eq("id", existing.id);
  else await db().from("trust_profiles").insert(row);

  await db().from("trust_events").insert({
    entity_type: input.entityType,
    entity_key: input.entityKey,
    user_id: input.userId ?? null,
    run_id: input.runId ?? null,
    delta: Number((next - prev).toFixed(2)),
    score_after: next,
    reason: input.reason.slice(0, 300),
    evidence: input.evidence ?? {},
  });

  return { score: next, delta: next - prev };
}

/**
 * Executive Decision Score — business value, impact, trust, rollback and ROI
 * for one recommendation. Derived from signals the run already produced.
 */
export function executiveDecisionScore(input: {
  trustScore: number;
  qualityScore?: number | null;
  costUsd: number;
  expectedValueUsd?: number | null;
  risks: number;
  alternatives: number;
  rollbackPossible: boolean;
  futureImpact?: number | null;
}) {
  const trust = clamp(input.trustScore);
  const quality = clamp(input.qualityScore ?? trust);
  const financial = input.expectedValueUsd != null && input.costUsd > 0
    ? clamp((input.expectedValueUsd / Math.max(input.costUsd, 0.0001)) * 10)
    : clamp(100 - input.costUsd * 500);
  const future = clamp(input.futureImpact ?? (trust * 0.6 + quality * 0.4));
  const risk = clamp(100 - input.risks * 12);
  const overall = clamp(trust * 0.3 + quality * 0.2 + financial * 0.2 + future * 0.15 + risk * 0.15);
  return {
    business_value: quality,
    future_impact: future,
    financial_impact: financial,
    technical_impact: quality,
    trust_score: trust,
    risk_score: risk,
    alternatives: input.alternatives,
    rollback_possible: input.rollbackPossible,
    estimated_roi: input.expectedValueUsd != null
      ? Number((input.expectedValueUsd - input.costUsd).toFixed(4))
      : null,
    overall_confidence: overall,
    verdict: overall >= 75 ? "recommended" : overall >= 55 ? "conditional" : "hold",
  };
}

/**
 * Continuous self-improvement: find the weak links across every trust profile.
 * Read-only — it produces findings, never changes anything.
 */
export async function findWeakLinks(minSamples = 3, weakBelow = 45) {
  const rows = await listTrustProfiles();
  return rows
    .filter((r) => Number(r.samples || 0) >= minSamples && Number(r.trust_score) < weakBelow)
    .map((r) => ({
      entity_type: r.entity_type,
      entity_key: r.entity_key,
      trust_score: Number(r.trust_score),
      samples: Number(r.samples),
      failures: Number(r.failures),
      reason:
        Number(r.failures) > Number(r.successes)
          ? "معدّل إخفاق أعلى من النجاح"
          : Number(r.contradictions) > 0
            ? "تناقضات متكررة في المخرجات"
            : "ثقة منخفضة رغم استقرار التنفيذ",
    }));
}
