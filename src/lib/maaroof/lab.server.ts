// Part 19.5 — Reality Lab. إنشاء محدود فوق محركات موجودة.
//
// This is the only genuinely new surface in Part 19.2–19.7: the platform had no
// place to state a hypothesis, run it repeatedly, and check reproducibility.
// It still creates nothing parallel: an experiment iteration is executed through
// the Reality Execution Engine, measured by the Benchmark Engine, judged by the
// Reality Verification Engine, and closed back into knowledge + trust.

import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export const LAB_STATUSES = ["draft", "running", "reproduced", "refuted", "inconclusive", "archived"] as const;
export type LabStatus = (typeof LAB_STATUSES)[number];

export type ExperimentInput = {
  title: string;
  objective?: string | null;
  hypothesis?: string | null;
  scope?: "platform" | "workspace" | "user";
  subject?: string | null;
  variables?: Record<string, any>;
  method?: string | null;
  sampleTarget?: number;
  userId?: string | null;
  workspaceId?: string | null;
};

export async function createExperiment(input: ExperimentInput): Promise<string | null> {
  try {
    const { data } = await db()
      .from("lab_experiments")
      .insert({
        title: input.title,
        objective: input.objective ?? null,
        hypothesis: input.hypothesis ?? null,
        scope: input.scope || "platform",
        subject: input.subject ?? null,
        variables: input.variables || {},
        method: input.method ?? null,
        sample_target: input.sampleTarget ?? 3,
        user_id: input.userId ?? null,
        workspace_id: input.workspaceId ?? null,
        status: "draft",
      })
      .select("id")
      .single();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

/** Numeric deviation between expected and observed maps (0 = identical). */
export function deviationOf(expected: Record<string, any>, observed: Record<string, any>): number {
  const keys = Object.keys(expected || {});
  if (!keys.length) return 0;
  let sum = 0;
  let n = 0;
  for (const k of keys) {
    const e = Number(expected[k]);
    const o = Number(observed?.[k]);
    if (Number.isNaN(e) || Number.isNaN(o)) continue;
    const denom = Math.abs(e) || 1;
    sum += Math.abs(o - e) / denom;
    n++;
  }
  return n ? Number((sum / n).toFixed(4)) : 0;
}

/** Record one iteration of an experiment and re-evaluate reproducibility. */
export async function recordLabRun(input: {
  experimentId: string;
  expected: Record<string, any>;
  observed: Record<string, any>;
  executionId?: string | null;
  userId?: string | null;
  realityState?: string | null;
  evidenceCount?: number;
  notes?: string | null;
  tolerance?: number;
}): Promise<{ ok: boolean; matched: boolean; deviation: number; status: LabStatus } | null> {
  try {
    const deviation = deviationOf(input.expected, input.observed);
    const tolerance = input.tolerance ?? 0.15;
    const matched = deviation <= tolerance;

    const { data: prev } = await db().from("lab_runs").select("iteration").eq("experiment_id", input.experimentId).order("iteration", { ascending: false }).limit(1);
    const iteration = ((prev as any[])?.[0]?.iteration || 0) + 1;

    await db().from("lab_runs").insert({
      experiment_id: input.experimentId,
      user_id: input.userId ?? null,
      execution_id: input.executionId ?? null,
      iteration,
      expected: input.expected,
      observed: input.observed,
      matched,
      deviation,
      reality_state: input.realityState ?? null,
      evidence_count: input.evidenceCount ?? 0,
      notes: input.notes ?? null,
    });

    const { data: expRow } = await db().from("lab_experiments").select("*").eq("id", input.experimentId).single();
    const { data: allRuns } = await db().from("lab_runs").select("matched").eq("experiment_id", input.experimentId);
    const runs = (allRuns as any[]) || [];
    const hits = runs.filter((r) => r.matched).length;
    const target = (expRow as any)?.sample_target || 3;
    const confidence = runs.length ? Math.round((hits / runs.length) * 100) : 0;

    let status: LabStatus = "running";
    if (runs.length >= target && hits >= target) status = "reproduced";
    else if (runs.length >= target && hits === 0) status = "refuted";
    else if (runs.length >= target) status = "inconclusive";

    await db().from("lab_experiments").update({
      status,
      reproduced: status === "reproduced",
      confidence,
      reality_state: status === "reproduced" ? "verified" : status === "refuted" ? "hypothesis" : "experimental",
      conclusion:
        status === "reproduced"
          ? `تكرّرت النتيجة ${hits} مرة من ${runs.length} — الفرضية مدعومة.`
          : status === "refuted"
            ? `لم تتكرر النتيجة في ${runs.length} محاولة — الفرضية مرفوضة.`
            : `${hits} من ${runs.length} تطابق — يلزم عيّنات إضافية.`,
    }).eq("id", input.experimentId);

    if (status === "reproduced" || status === "refuted") {
      await closeExperimentLoop(input.experimentId, status, confidence);
    }
    return { ok: true, matched, deviation, status };
  } catch {
    return null;
  }
}

/** Feed a settled experiment back into the knowledge graph and trust engine. */
export async function closeExperimentLoop(experimentId: string, status: LabStatus, confidence: number): Promise<void> {
  try {
    const { data } = await db().from("lab_experiments").select("*").eq("id", experimentId).single();
    const exp = data as any;
    if (!exp) return;
    const positive = status === "reproduced";

    try {
      const { upsertKnowledgeNode } = await import("@/lib/maaroof/knowledge.server");
      await upsertKnowledgeNode({
        layer: "platform",
        key: `lab:${experimentId}`,
        title: exp.title,
        summary: exp.conclusion || exp.hypothesis || exp.title,
        payload: { hypothesis: exp.hypothesis, variables: exp.variables, status },
        sources: [{ source_kind: "experiment", source_ref: experimentId }],
        confidence,
        reliability: positive ? confidence : Math.max(10, 100 - confidence),
        importance: positive ? 80 : 40,
        scope: exp.workspace_id ? "workspace" : "platform",
        userId: exp.user_id || null,
        workspaceId: exp.workspace_id || null,
      } as any);
    } catch {}

    try {
      const { recordTrustEvent } = await import("@/lib/maaroof/trust.server");
      await recordTrustEvent({
        entityType: "architecture",
        entityKey: `lab:${experimentId}`,
        ok: positive,
        reason: `lab:${status}`,
        confidence,
        contradiction: status === "refuted",
      } as any);
    } catch {}

    await db().from("lab_experiments").update({
      knowledge_impact: positive ? confidence : -Math.round(confidence / 2),
      trust_impact: positive ? Math.round(confidence / 2) : -Math.round(confidence / 2),
    }).eq("id", experimentId);
  } catch {}
}

/** Full detail for one experiment. */
export async function experimentDetail(experimentId: string) {
  try {
    const [{ data: exp }, { data: runs }] = await Promise.all([
      db().from("lab_experiments").select("*").eq("id", experimentId).single(),
      db().from("lab_runs").select("*").eq("experiment_id", experimentId).order("iteration"),
    ]);
    return { experiment: exp || null, runs: (runs as any[]) || [] };
  } catch {
    return { experiment: null, runs: [] };
  }
}

/** Aggregates for the Reality Lab panel. */
export async function labOverview(limit = 60) {
  try {
    const { data } = await db()
      .from("lab_experiments")
      .select("id, title, hypothesis, status, reproduced, confidence, reality_state, knowledge_impact, trust_impact, sample_target, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = (data as any[]) || [];
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    return {
      total: rows.length,
      by_status: byStatus,
      reproduced: rows.filter((r) => r.reproduced).length,
      avg_confidence: rows.length ? Math.round(rows.reduce((a, r) => a + Number(r.confidence || 0), 0) / rows.length) : 0,
      recent: rows.slice(0, 20),
    };
  } catch {
    return { total: 0, by_status: {}, reproduced: 0, avg_confidence: 0, recent: [] as any[] };
  }
}
