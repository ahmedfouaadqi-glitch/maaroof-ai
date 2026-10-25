import { createHash } from "node:crypto";
// Part 19.4 — Benchmark Engine (تطوير لا إنشاء).
//
// `ai_model_benchmarks`, `expert_snapshots` and `capability_scores_v` already
// benchmark models and experts. What was missing is a *general* benchmark for
// any subject (tool, campaign, workspace, competitor) measured over time
// against an explicit baseline. This module adds only that, and links each
// result back to the execution that produced it.
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

export const BENCHMARK_SUBJECT_KINDS = ["tool", "expert", "model", "workspace", "campaign", "competitor", "platform"] as const;
export type BenchmarkSubjectKind = (typeof BENCHMARK_SUBJECT_KINDS)[number];

export type BenchmarkDefinition = {
  subject: string;
  subjectKind: BenchmarkSubjectKind;
  metric: string;
  unit?: string | null;
  baseline?: number | null;
  target?: number | null;
  higherIsBetter?: boolean;
  notes?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
};

/** Namespaced storage key: preserves the legacy unique index without crossing user/workspace baselines. */
export function benchmarkStorageSubject(subject: string, userId?: string | null, workspaceId?: string | null): string {
  const base = String(subject || "").trim().slice(0, 240);
  if (!userId) return base;
  const scopeHash = createHash("sha256")
    .update(String(userId) + "|" + String(workspaceId || "__user_scope__"))
    .digest("hex")
    .slice(0, 12);
  return base + " [scope:" + scopeHash + "]";
}
export function benchmarkDisplaySubject(subject: string): string {
  return String(subject || "").replace(/\s+\[scope:[0-9a-f]{12}\]$/i, "");
}

/** Create or update a benchmark definition; returns its id. */
export async function upsertBenchmark(def: BenchmarkDefinition): Promise<string | null> {
  try {
    const { data } = await db()
      .from("benchmarks")
      .upsert(
        {
          subject: benchmarkStorageSubject(def.subject, def.userId, def.workspaceId),
          subject_kind: def.subjectKind,
          metric: def.metric,
          unit: def.unit ?? null,
          baseline: def.baseline ?? null,
          target: def.target ?? null,
          higher_is_better: def.higherIsBetter !== false,
          notes: def.notes ?? null,
          user_id: def.userId ?? null,
          workspace_id: def.workspaceId ?? null,
        },
        { onConflict: "subject_kind,subject,metric" },
      )
      .select("id")
      .single();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

/** Did this measurement beat the baseline, in the metric's own direction? */
export function scoreAgainstBaseline(value: number, baseline: number | null | undefined, higherIsBetter = true) {
  if (baseline == null) return { delta: null as number | null, passed: null as boolean | null, improvement: 0 };
  const delta = Number((value - baseline).toFixed(4));
  const passed = higherIsBetter ? value >= baseline : value <= baseline;
  const denom = Math.abs(baseline) || 1;
  const improvement = Math.round(((higherIsBetter ? delta : -delta) / denom) * 100);
  return { delta, passed, improvement };
}

/** Record a measurement against a benchmark definition. */
export async function recordBenchmark(input: {
  subject: string;
  subjectKind: BenchmarkSubjectKind;
  metric: string;
  value: number;
  unit?: string | null;
  baseline?: number | null;
  target?: number | null;
  higherIsBetter?: boolean;
  executionId?: string | null;
  runId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  sampleSize?: number;
  source?: string | null;
  meta?: Record<string, any>;
  comparisonKey?: string | null;
}): Promise<{ id: string | null; delta: number | null; passed: boolean | null; improvement: number }> {
  const empty = { id: null, delta: null, passed: null, improvement: 0 };
  try {
    const benchmarkId = await upsertBenchmark({
      subject: input.subject,
      subjectKind: input.subjectKind,
      metric: input.metric,
      unit: input.unit,
      baseline: input.baseline,
      target: input.target,
      higherIsBetter: input.higherIsBetter,
      userId: input.userId,
      workspaceId: input.workspaceId,
    });
    if (!benchmarkId) return empty;

    const { data: bm } = await db().from("benchmarks").select("baseline, higher_is_better").eq("id", benchmarkId).single();
    const scored = scoreAgainstBaseline(input.value, (bm as any)?.baseline, (bm as any)?.higher_is_better !== false);

    const { data } = await db()
      .from("benchmark_results")
      .insert({
        benchmark_id: benchmarkId,
        user_id: input.userId ?? null,
        execution_id: input.executionId ?? null,
        run_id: input.runId ?? null,
        value: input.value,
        delta_vs_baseline: scored.delta,
        passed: scored.passed,
        sample_size: input.sampleSize ?? 1,
        source: input.source ?? null,
        meta: {
          ...(input.meta || {}),
          ...(input.comparisonKey ? { comparison_key: input.comparisonKey } : {}),
          workspace_id: input.workspaceId ?? null,
        },
      })
      .select("id")
      .single();
    return { id: (data as any)?.id ?? null, ...scored };
  } catch {
    return empty;
  }
}

export type TrendPoint = { at: string; value: number; passed: boolean | null };

/** Time-series comparison for one benchmark: trend direction and volatility. */
export async function benchmarkTrend(
  subjectKind: BenchmarkSubjectKind,
  subject: string,
  metric: string,
  limit = 30,
  scope?: { userId?: string | null; workspaceId?: string | null; comparisonKey?: string | null },
) {
  try {
    // Scoped verification fails closed: a user must never inherit another user's benchmark baseline.
    if (scope && !scope.userId) return null;
    const storedSubject = benchmarkStorageSubject(subject, scope?.userId, scope?.workspaceId);
    let benchmarkQuery = db()
      .from("benchmarks")
      .select("id, baseline, target, unit, higher_is_better, user_id, workspace_id")
      .eq("subject_kind", subjectKind)
      .eq("subject", storedSubject)
      .eq("metric", metric);
    if (scope?.userId) benchmarkQuery = benchmarkQuery.eq("user_id", scope.userId);
    if (scope && Object.prototype.hasOwnProperty.call(scope, "workspaceId")) {
      benchmarkQuery = scope.workspaceId ? benchmarkQuery.eq("workspace_id", scope.workspaceId) : benchmarkQuery.is("workspace_id", null);
    }
    const { data: bm } = await benchmarkQuery.maybeSingle();
    if (!bm) return null;
    const { data } = await db()
      .from("benchmark_results")
      .select("value, passed, created_at, meta, user_id")
      .eq("benchmark_id", (bm as any).id)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(200, Math.floor(limit) || 30)));
    let scopedRows = ((data as any[]) || []);
    if (scope?.userId) scopedRows = scopedRows.filter((r) => r.user_id === scope.userId);
    const requestedKey = String(scope?.comparisonKey || "");
    // When measurement conditions differ, only compare points made with the same signature.
    const latestKey = requestedKey || String(scopedRows[0]?.meta?.comparison_key || "");
    if (latestKey) scopedRows = scopedRows.filter((r) => String(r.meta?.comparison_key || "") === latestKey);
    const rows = scopedRows.reverse();
    const points: TrendPoint[] = rows.map((r) => ({ at: r.created_at, value: Number(r.value), passed: r.passed }));
    if (!points.length) return { ...(bm as any), points, latest: null, trend: "flat" as const, pass_rate: 0 };
    const first = points[0].value;
    const latest = points[points.length - 1].value;
    const higher = (bm as any).higher_is_better !== false;
    const raw = latest - first;
    const better = higher ? raw > 0 : raw < 0;
    const trend = Math.abs(raw) < Math.abs(first) * 0.02 ? "flat" : better ? "improving" : "declining";
    const passRate = Math.round((points.filter((p) => p.passed).length / points.length) * 100);
    return { ...(bm as any), points, latest, trend, pass_rate: passRate };
  } catch {
    return null;
  }
}

/** Aggregate view for the Reality Lab benchmark panel. */
export async function benchmarkOverview(limit = 50) {
  try {
    const { data: defs } = await db()
      .from("benchmarks")
      .select("id, subject, subject_kind, metric, unit, baseline, target, higher_is_better, user_id, workspace_id")
      .order("updated_at", { ascending: false })
      .limit(limit);
    const list = (defs as any[]) || [];
    if (!list.length) return { total: 0, items: [] as any[] };
    const { data: results } = await db()
      .from("benchmark_results")
      .select("benchmark_id, value, passed, created_at")
      .in("benchmark_id", list.map((d) => d.id))
      .order("created_at", { ascending: false })
      .limit(1000);
    const byBm: Record<string, any[]> = {};
    for (const r of (results as any[]) || []) (byBm[r.benchmark_id] ||= []).push(r);
    const items = list.map((d) => {
      const rows = byBm[d.id] || [];
      const latest = rows[0]?.value != null ? Number(rows[0].value) : null;
      const scored = latest != null ? scoreAgainstBaseline(latest, d.baseline, d.higher_is_better !== false) : null;
      return {
        ...d,
        subject: benchmarkDisplaySubject(d.subject),
        samples: rows.length,
        latest,
        improvement: scored?.improvement ?? 0,
        passed: scored?.passed ?? null,
        pass_rate: rows.length ? Math.round((rows.filter((r) => r.passed).length / rows.length) * 100) : 0,
      };
    });
    return { total: items.length, items };
  } catch {
    return { total: 0, items: [] as any[] };
  }
}
