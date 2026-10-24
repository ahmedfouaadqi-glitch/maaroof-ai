// Part 19.4 — Evidence Engine (تطوير لا إنشاء).
//
// The `evidence_items` table already existed (created in Part 19.1 as the audit
// trail behind a reality record). Instead of creating a parallel "evidence
// store", this module extends that same table with classification, weighting,
// freshness decay and cross-validation. `reality.server.ts` keeps writing the
// rows it always wrote; this layer enriches and reads them.
//
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

/** Constitutional evidence taxonomy (strongest → weakest). */
export const EVIDENCE_TYPES = [
  "execution", // we ran it and it worked
  "measurement", // we measured a number
  "observation", // we saw it happen
  "document", // primary source document
  "external", // third-party source
  "historical", // past runs / memory
  "expert", // expert-model opinion
  "inference", // derived by reasoning
  "assumption", // unverified premise
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_TYPE_STRENGTH: Record<EvidenceType, number> = {
  execution: 100,
  measurement: 92,
  observation: 78,
  document: 70,
  external: 60,
  historical: 52,
  expert: 40,
  inference: 28,
  assumption: 10,
};

export const EVIDENCE_CATEGORIES = [
  "market",
  "technical",
  "financial",
  "behavioral",
  "operational",
  "regulatory",
  "platform",
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

/** Default shelf-life per category, in days. Governs freshness decay. */
const SHELF_LIFE_DAYS: Record<string, number> = {
  market: 45,
  technical: 120,
  financial: 30,
  behavioral: 60,
  operational: 90,
  regulatory: 180,
  platform: 90,
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export type EvidenceInput = {
  realityRecordId?: string | null;
  executionId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  title?: string | null;
  claim?: string | null;
  sourceKind: string;
  sourceRef?: string | null;
  evidenceType: EvidenceType;
  category?: EvidenceCategory | string | null;
  collectionMethod?: string | null;
  sourceReliability?: number;
  businessValue?: number;
  successCount?: number;
  reproducible?: boolean;
  contradicts?: any[];
  expertKey?: string | null;
  language?: string;
};

/** Days elapsed since a timestamp (0 when unknown). */
export function ageDays(iso?: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

/** Linear decay to zero across the category shelf life. */
export function freshnessOf(category: string | null | undefined, createdAt?: string | null): number {
  const life = SHELF_LIFE_DAYS[String(category || "platform")] ?? 90;
  return clamp(100 - (ageDays(createdAt) / life) * 100);
}

/**
 * Composite weight of a single piece of evidence (0-100).
 * type strength · source reliability · reproducibility · freshness · value.
 */
export function weighEvidence(input: {
  evidenceType: EvidenceType | string;
  sourceReliability?: number | null;
  reproducible?: boolean | null;
  successCount?: number | null;
  freshness?: number | null;
  businessValue?: number | null;
  contradicts?: any[] | null;
}): number {
  const base = EVIDENCE_TYPE_STRENGTH[input.evidenceType as EvidenceType] ?? 30;
  const rel = input.sourceReliability ?? 50;
  const fresh = input.freshness ?? 100;
  const value = input.businessValue ?? 50;
  const repro = input.reproducible ? 12 : 0;
  const streak = Math.min(Number(input.successCount || 0), 5) * 3;
  const penalty = (input.contradicts?.length || 0) * 12;
  return clamp(base * 0.45 + rel * 0.2 + fresh * 0.2 + value * 0.15 + repro + streak - penalty);
}

/** Persist one classified evidence item. Never throws into a run. */
export async function recordEvidence(input: EvidenceInput): Promise<string | null> {
  try {
    const freshness = 100;
    const weight = weighEvidence({
      evidenceType: input.evidenceType,
      sourceReliability: input.sourceReliability,
      reproducible: input.reproducible,
      successCount: input.successCount,
      freshness,
      businessValue: input.businessValue,
      contradicts: input.contradicts,
    });
    const life = SHELF_LIFE_DAYS[String(input.category || "platform")] ?? 90;
    const { data } = await db()
      .from("evidence_items")
      .insert({
        reality_record_id: input.realityRecordId ?? null,
        execution_id: input.executionId ?? null,
        user_id: input.userId ?? null,
        workspace_id: input.workspaceId ?? null,
        title: input.title ?? null,
        claim: input.claim ?? null,
        source_kind: input.sourceKind,
        source_ref: input.sourceRef ?? null,
        evidence_type: input.evidenceType,
        category: input.category ?? null,
        collection_method: input.collectionMethod ?? null,
        source_reliability: clamp(input.sourceReliability ?? 50),
        business_value: clamp(input.businessValue ?? 50),
        success_count: input.successCount ?? 0,
        reproducible: !!input.reproducible,
        contradicts: input.contradicts || [],
        expert_key: input.expertKey ?? null,
        language: input.language || "ar",
        weight,
        freshness,
        expires_at: new Date(Date.now() + life * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

export type CrossValidation = {
  total: number;
  independent_sources: number;
  agreeing: number;
  contradicting: number;
  agreement: number;
  strongest_type: string | null;
  weighted_score: number;
  avg_freshness: number;
  stale: number;
  verdict: "corroborated" | "supported" | "weak" | "contested" | "none";
};

/** Cross-validate a set of evidence rows: independence, agreement, weight. */
export function crossValidate(rows: any[]): CrossValidation {
  const items = rows || [];
  if (!items.length) {
    return {
      total: 0, independent_sources: 0, agreeing: 0, contradicting: 0, agreement: 0,
      strongest_type: null, weighted_score: 0, avg_freshness: 0, stale: 0, verdict: "none",
    };
  }
  const sources = new Set(items.map((r) => String(r.source_ref || r.source_kind || "?")));
  const contradicting = items.filter((r) => (r.contradicts?.length || 0) > 0).length;
  const agreeing = items.length - contradicting;
  const fresh = items.map((r) => (r.freshness != null ? Number(r.freshness) : freshnessOf(r.category, r.created_at)));
  const avgFresh = clamp(fresh.reduce((a, b) => a + b, 0) / fresh.length);
  const stale = fresh.filter((f) => f < 35).length;
  const weights = items.map((r) =>
    Number(r.weight) > 0
      ? Number(r.weight)
      : weighEvidence({ evidenceType: r.evidence_type, sourceReliability: r.source_reliability, reproducible: r.reproducible, successCount: r.success_count, freshness: r.freshness, businessValue: r.business_value, contradicts: r.contradicts }),
  );
  const weighted = clamp(weights.reduce((a, b) => a + b, 0) / weights.length);
  const strongest = items
    .slice()
    .sort(
      (a, b) =>
        (EVIDENCE_TYPE_STRENGTH[b.evidence_type as EvidenceType] ?? 0) -
        (EVIDENCE_TYPE_STRENGTH[a.evidence_type as EvidenceType] ?? 0),
    )[0]?.evidence_type ?? null;
  const agreement = clamp((agreeing / items.length) * 100);
  const independent = sources.size;

  let verdict: CrossValidation["verdict"];
  if (contradicting > agreeing) verdict = "contested";
  else if (independent >= 3 && weighted >= 65 && agreement >= 80) verdict = "corroborated";
  else if (independent >= 2 && weighted >= 45) verdict = "supported";
  else verdict = "weak";

  return {
    total: items.length,
    independent_sources: independent,
    agreeing,
    contradicting,
    agreement,
    strongest_type: strongest,
    weighted_score: weighted,
    avg_freshness: avgFresh,
    stale,
    verdict,
  };
}

/** Load evidence for a reality record or an execution and cross-validate it. */
export async function validateEvidenceFor(opts: {
  realityRecordId?: string | null;
  executionId?: string | null;
  limit?: number;
}): Promise<{ items: any[]; validation: CrossValidation }> {
  try {
    let q = db()
      .from("evidence_items")
      .select(
        "id, title, claim, source_kind, source_ref, evidence_type, category, source_reliability, business_value, weight, freshness, reproducible, success_count, contradicts, expires_at, created_at",
      )
      .order("weight", { ascending: false })
      .limit(opts.limit ?? 200);
    if (opts.realityRecordId) q = q.eq("reality_record_id", opts.realityRecordId);
    if (opts.executionId) q = q.eq("execution_id", opts.executionId);
    const { data } = await q;
    const items = ((data as any[]) || []).map((r) => ({ ...r, freshness: freshnessOf(r.category, r.created_at) }));
    return { items, validation: crossValidate(items) };
  } catch {
    return { items: [], validation: crossValidate([]) };
  }
}

/** Refresh decayed freshness values and mark expired evidence. Idempotent. */
export async function decayEvidence(limit = 500): Promise<number> {
  try {
    const { data } = await db()
      .from("evidence_items")
      .select("id, category, created_at, freshness")
      .order("created_at", { ascending: true })
      .limit(limit);
    const rows = (data as any[]) || [];
    let touched = 0;
    for (const r of rows) {
      const f = freshnessOf(r.category, r.created_at);
      if (Math.abs(f - Number(r.freshness ?? 100)) < 5) continue;
      await db().from("evidence_items").update({ freshness: f }).eq("id", r.id);
      touched++;
    }
    return touched;
  } catch {
    return 0;
  }
}

/** Aggregates for the Reality Lab / Evidence panel. */
export async function evidenceOverview(limit = 400) {
  try {
    const { data } = await db()
      .from("evidence_items")
      .select("id, evidence_type, category, weight, freshness, reproducible, contradicts, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = (data as any[]) || [];
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      const t = r.evidence_type || "unclassified";
      byType[t] = (byType[t] || 0) + 1;
      const c = r.category || "uncategorised";
      byCategory[c] = (byCategory[c] || 0) + 1;
    }
    const validation = crossValidate(rows);
    return { total: rows.length, by_type: byType, by_category: byCategory, validation };
  } catch {
    return { total: 0, by_type: {}, by_category: {}, validation: crossValidate([]) };
  }
}
