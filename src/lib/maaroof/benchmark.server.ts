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

/** Create or update a benchmark definition; returns its id. */
export async function upsertBenchmark(def: BenchmarkDefinition): Promise<string | null> {
  try {
    const { data } = await db()
      .from("benchmarks")
      .upsert(
        {
          subject: def.subject,
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
        meta: input.meta || {},
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
export async function benchmarkTrend(subjectKind: BenchmarkSubjectKind, subject: string, metric: string, limit = 30) {
  try {
    const { data: bm } = await db()
      .from("benchmarks")
      .select("id, baseline, target, unit, higher_is_better")
      .eq("subject_kind", subjectKind)
      .eq("subject", subject)
      .eq("metric", metric)
      .maybeSingle();
    if (!bm) return null;
    const { data } = await db()
      .from("benchmark_results")
      .select("value, passed, created_at")
      .eq("benchmark_id", (bm as any).id)
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = ((data as any[]) || []).reverse();
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
      .select("id, subject, subject_kind, metric, unit, baseline, target, higher_is_better")
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
