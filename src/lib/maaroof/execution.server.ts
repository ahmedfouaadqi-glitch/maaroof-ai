// Part 19.2 — Reality Execution Engine (REE). تطوير لا إنشاء.
//
// The platform already had: `workflow.server.ts` (graph traversal),
// `capability.server.ts` (which expert implements a capability),
// `models.server.ts` (which model, at what cost), `agent_tasks` and
// `hermes_tasks` (task records), `maaroof_schedules` (recurring work).
// What was missing was a single *execution record* that ties a founder goal to
// a plan, to concrete tasks, to measured outcomes, to evidence, to a reality
// state. This module adds only that seam; it dispatches through the engines
// above instead of re-implementing them.
//
// Planning and measurement are fully local arithmetic — zero extra model calls.

import { createClient } from "@supabase/supabase-js";
import { listCapabilities, type Capability } from "@/lib/tool-catalog";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

/** Constitutional execution stages — every execution stamps where it stopped. */
export const EXECUTION_STAGES = [
  "goal",
  "plan",
  "resource_map",
  "approval",
  "run",
  "measure",
  "evidence",
  "verify",
  "learn",
  "report",
] as const;
export type ExecutionStage = (typeof EXECUTION_STAGES)[number];

export const EXECUTION_MODES = ["simulation", "recommendation", "execution"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export type PlannedTask = {
  seq: number;
  title: string;
  description?: string;
  capability?: Capability | string | null;
  expert_key?: string | null;
  model_key?: string | null;
  mcp_provider?: string | null;
  input?: Record<string, any>;
};

/** Optional real dispatcher. When absent, tasks stay simulated (honest by default). */
export type TaskRunner = (task: PlannedTask) => Promise<{
  ok: boolean;
  output?: Record<string, any>;
  measured?: Record<string, any>;
  costUsd?: number;
  tokens?: number;
  error?: string;
}>;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Append an immutable monitoring event. Never throws into a run. */
export async function logExecutionEvent(input: {
  executionId: string;
  stage: ExecutionStage | string;
  kind?: "info" | "warn" | "error" | "success";
  summary?: string;
  taskId?: string | null;
  userId?: string | null;
  payload?: Record<string, any>;
}): Promise<void> {
  try {
    await db().from("execution_events").insert({
      execution_id: input.executionId,
      task_id: input.taskId ?? null,
      user_id: input.userId ?? null,
      stage: input.stage,
      kind: input.kind || "info",
      summary: input.summary ?? null,
      payload: input.payload || {},
    });
  } catch {}
}

/**
 * Deterministic decomposition of a goal into capability-shaped tasks.
 * Uses keyword→capability matching against the existing capability registry;
 * always produces a research → analyse → produce → verify skeleton.
 */
export function planGoal(goal: string, opts?: { capabilities?: string[]; language?: string }): PlannedTask[] {
  const caps = (opts?.capabilities?.length ? opts.capabilities : (listCapabilities() as string[])) || [];
  const text = (goal || "").toLowerCase();
  const matched = caps.filter((c) => {
    const words = String(c).split(/[_\-\s]+/).filter((w) => w.length > 3);
    return words.some((w) => text.includes(w));
  });
  const chosen = (matched.length ? matched : caps.slice(0, 2)).slice(0, 4);

  const tasks: PlannedTask[] = [
    { seq: 1, title: "جمع الواقع", description: "جمع البيانات والمصادر الحالية قبل أي استنتاج.", capability: chosen[0] ?? null },
  ];
  chosen.slice(1).forEach((c, i) => {
    tasks.push({ seq: tasks.length + 1, title: `تنفيذ القدرة: ${c}`, capability: c });
  });
  tasks.push({ seq: tasks.length + 1, title: "قياس النتيجة", description: "قياس المخرجات مقابل خط الأساس.", capability: null });
  tasks.push({ seq: tasks.length + 1, title: "توثيق الأدلة والتحقق", description: "تسجيل الأدلة وتصنيف حالة الواقع.", capability: null });
  return tasks;
}

/** Attach a live expert/model to each planned task using the existing pickers. */
export async function mapResources(tasks: PlannedTask[]): Promise<PlannedTask[]> {
  try {
    const { loadCapabilityScores, chooseImplementation } = await import("@/lib/maaroof/capability.server");
    const scores = await loadCapabilityScores();
    return tasks.map((t) => {
      if (!t.capability) return t;
      const choice = chooseImplementation({ capability: t.capability as Capability, scores });
      return choice ? { ...t, expert_key: choice.expert.key } : t;
    });
  } catch {
    return tasks;
  }
}

/** Create an execution + its tasks in `draft`. No side effects beyond persistence. */
export async function createExecution(input: {
  goal: string;
  strategy?: string | null;
  mode?: ExecutionMode;
  userId?: string | null;
  workspaceId?: string | null;
  runId?: string | null;
  language?: string;
  expectedOutcome?: string | null;
  priority?: number;
  approvalRequired?: boolean;
  tasks?: PlannedTask[];
}): Promise<{ id: string; tasks: PlannedTask[] } | null> {
  try {
    const planned = await mapResources(input.tasks?.length ? input.tasks : planGoal(input.goal, { language: input.language }));
    const { data, error } = await db()
      .from("executions")
      .insert({
        goal: input.goal,
        strategy: input.strategy ?? null,
        plan: planned,
        mode: input.mode || "simulation",
        status: "draft",
        user_id: input.userId ?? null,
        workspace_id: input.workspaceId ?? null,
        run_id: input.runId ?? null,
        language: input.language || "ar",
        expected_outcome: input.expectedOutcome ?? null,
        priority: input.priority ?? 50,
        approval_required: input.approvalRequired !== false,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    const id = (data as any).id as string;
    await db().from("execution_tasks").insert(
      planned.map((t) => ({
        execution_id: id,
        user_id: input.userId ?? null,
        seq: t.seq,
        title: t.title,
        description: t.description ?? null,
        capability_key: (t.capability as string) ?? null,
        expert_key: t.expert_key ?? null,
        model_key: t.model_key ?? null,
        mcp_provider: t.mcp_provider ?? null,
        input: t.input || {},
      })),
    );
    await logExecutionEvent({ executionId: id, stage: "plan", kind: "success", summary: `خطة من ${planned.length} مهمة`, userId: input.userId, payload: { plan: planned } });
    return { id, tasks: planned };
  } catch {
    return null;
  }
}

/** Founder approval gate (Law: never execute without approval). */
export async function approveExecution(executionId: string, approverId: string): Promise<boolean> {
  try {
    await db().from("executions").update({ status: "approved", approved_by: approverId, approved_at: new Date().toISOString() }).eq("id", executionId);
    await logExecutionEvent({ executionId, stage: "approval", kind: "success", summary: "اعتماد المؤسس", userId: approverId });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run an execution end-to-end: run → measure → evidence → verify → learn → report.
 * Without a `runner`, tasks are marked `simulated` and the reality state stays
 * at simulation level — the engine never claims execution it did not perform.
 */
export async function runExecution(input: {
  executionId: string;
  userId?: string | null;
  workspaceId?: string | null;
  runner?: TaskRunner;
}): Promise<{ ok: boolean; status: string; outcome_score: number; reality_state: string | null }> {
  const fail = { ok: false, status: "failed", outcome_score: 0, reality_state: null as string | null };
  try {
    const { data: exec } = await db().from("executions").select("*").eq("id", input.executionId).single();
    if (!exec) return fail;
    const e = exec as any;
    if (e.approval_required && !e.approved_at && e.mode === "execution") {
      await logExecutionEvent({ executionId: e.id, stage: "approval", kind: "warn", summary: "التنفيذ متوقف بانتظار اعتماد المؤسس", userId: input.userId });
      return { ok: false, status: "awaiting_approval", outcome_score: 0, reality_state: null };
    }

    await db().from("executions").update({ status: "running", started_at: new Date().toISOString() }).eq("id", e.id);
    const { data: taskRows } = await db().from("execution_tasks").select("*").eq("execution_id", e.id).order("seq");
    const tasks = (taskRows as any[]) || [];

    let okCount = 0;
    let costUsd = 0;
    let tokens = 0;
    const results: Array<{ tool: string; ok: boolean }> = [];

    const { fromTaskStatus, rollupTasks } = await import("@/lib/maaroof/truth");
    const taskStates: Array<{ status: string }> = [];

    for (const t of tasks) {
      const planned: PlannedTask = {
        seq: t.seq, title: t.title, description: t.description, capability: t.capability_key,
        expert_key: t.expert_key, model_key: t.model_key, mcp_provider: t.mcp_provider, input: t.input,
      };
      const kind = t.mcp_provider ? "mcp" : t.capability_key ? "tool" : t.expert_key ? "expert" : "internal";
      const provider = t.mcp_provider || t.model_key || t.expert_key || null;
      if (!input.runner || e.mode !== "execution") {
        await db().from("execution_tasks").update({
          status: "simulated",
          verification_state: "SIMULATED",
          execution_kind: kind,
          result_kind: "simulation",
          provider,
          duration_ms: 0,
          finished_at: new Date().toISOString(),
        }).eq("id", t.id);
        taskStates.push({ status: "simulated" });
        await logExecutionEvent({ executionId: e.id, taskId: t.id, stage: "run", kind: "info", summary: `محاكاة: ${t.title}`, userId: input.userId });
        continue;
      }
      const startedAt = Date.now();
      await db().from("execution_tasks").update({
        status: "running", verification_state: "PENDING", execution_kind: kind, provider,
        started_at: new Date().toISOString(), attempts: (t.attempts || 0) + 1,
      }).eq("id", t.id);
      let r: Awaited<ReturnType<TaskRunner>>;
      try {
        r = await input.runner(planned);
      } catch (err: any) {
        r = { ok: false, error: String(err?.message || err) };
      }
      costUsd += r.costUsd || 0;
      tokens += r.tokens || 0;
      results.push({ tool: t.expert_key || t.capability_key || t.title, ok: !!r.ok });
      if (r.ok) okCount++;
      const status = r.ok ? "done" : "failed";
      taskStates.push({ status });
      await db().from("execution_tasks").update({
        status,
        verification_state: fromTaskStatus(status, r.measured),
        execution_kind: kind,
        result_kind: r.ok ? (r.measured && Object.keys(r.measured).length ? "measurement" : "output") : "error",
        provider,
        duration_ms: Date.now() - startedAt,
        output: r.output || {},
        measured: r.measured || {},
        cost_usd: r.costUsd || 0,
        tokens: r.tokens || 0,
        error: r.error ?? null,
        finished_at: new Date().toISOString(),
      }).eq("id", t.id);
      await logExecutionEvent({
        executionId: e.id, taskId: t.id, stage: "run", kind: r.ok ? "success" : "error",
        summary: `${r.ok ? "نجاح" : "فشل"}: ${t.title}`, userId: input.userId, payload: { error: r.error },
      });
    }

    const rollup = rollupTasks(taskStates);
    await logExecutionEvent({
      executionId: e.id, stage: "run", kind: rollup.verdict === "FAILED" ? "error" : "info",
      summary: `حصيلة المهام: ${rollup.verdict} (${rollup.done}/${rollup.total})`, userId: input.userId,
      payload: { rollup },
    });

    // ---- measure ----
    const executedCount = results.length;
    const outcomeScore = executedCount ? clamp((okCount / executedCount) * 100) : 0;
    await logExecutionEvent({ executionId: e.id, stage: "measure", kind: "info", summary: `نجاح ${okCount}/${executedCount || tasks.length}`, userId: input.userId });

    // ---- evidence ----
    try {
      const { recordEvidence } = await import("@/lib/maaroof/evidence.server");
      for (const r of results) {
        await recordEvidence({
          executionId: e.id,
          userId: input.userId ?? e.user_id,
          workspaceId: input.workspaceId ?? e.workspace_id,
          title: r.tool,
          claim: `${r.tool} → ${r.ok ? "نجح" : "فشل"}`,
          sourceKind: "execution",
          sourceRef: r.tool,
          evidenceType: "execution",
          category: "operational",
          collectionMethod: "reality_execution_engine",
          sourceReliability: 90,
          reproducible: r.ok,
          successCount: r.ok ? 1 : 0,
          language: e.language,
        });
      }
    } catch {}

    // ---- verify (delegates to the existing reality classifier) ----
    let realityState: string | null = null;
    try {
      const { classifyReality, persistReality, closeRealityLoop } = await import("@/lib/maaroof/reality.server");
      const assessment = classifyReality({
        toolResults: results,
        memoriesRecalled: 0,
        knowledgeNodes: 0,
        councilOpinions: 0,
        councilAvgConfidence: null,
        trustScore: null,
        trustRisks: 0,
        trustAlternatives: [],
        hasEnvision: false,
        timingVerdict: null,
        executionMode: e.mode,
        complianceVerdict: null,
        externalSources: 0,
        historicalSamples: 0,
        finalTextLength: (e.goal || "").length,
      });
      realityState = assessment.reality_state;
      await persistReality({
        assessment,
        runId: e.run_id,
        userId: e.user_id,
        workspaceId: e.workspace_id,
        subject: "execution",
        subjectRef: e.id,
        signals: { execution_id: e.id, ok: okCount, total: executedCount },
      });
      await closeRealityLoop({ assessment, runId: e.run_id, userId: e.user_id, workspaceId: e.workspace_id });
    } catch {}

    // ---- benchmark the execution itself ----
    try {
      const { recordBenchmark } = await import("@/lib/maaroof/benchmark.server");
      await recordBenchmark({
        subject: e.strategy || "execution",
        subjectKind: "platform",
        metric: "execution_success_rate",
        unit: "%",
        baseline: 70,
        value: outcomeScore,
        executionId: e.id,
        runId: e.run_id,
        userId: e.user_id,
        sampleSize: executedCount || tasks.length,
        source: "reality_execution_engine",
      });
    } catch {}

    const status = executedCount === 0 ? "simulated" : okCount === executedCount ? "done" : okCount > 0 ? "partial" : "failed";
    await db().from("executions").update({
      status,
      outcome_score: outcomeScore,
      reality_state: realityState,
      cost_usd: costUsd,
      tokens,
      measured_outcome: `نجاح ${okCount} من ${executedCount || tasks.length} مهمة`,
      finished_at: new Date().toISOString(),
    }).eq("id", e.id);
    await logExecutionEvent({ executionId: e.id, stage: "report", kind: "success", summary: `الحالة: ${status}`, userId: input.userId });

    return { ok: status === "done" || status === "simulated", status, outcome_score: outcomeScore, reality_state: realityState };
  } catch {
    return fail;
  }
}

/** Read one execution with its tasks and timeline. */
export async function executionDetail(executionId: string) {
  try {
    const [{ data: exec }, { data: tasks }, { data: events }] = await Promise.all([
      db().from("executions").select("*").eq("id", executionId).single(),
      db().from("execution_tasks").select("*").eq("execution_id", executionId).order("seq"),
      db().from("execution_events").select("*").eq("execution_id", executionId).order("created_at", { ascending: false }).limit(100),
    ]);
    return { execution: exec || null, tasks: (tasks as any[]) || [], events: (events as any[]) || [] };
  } catch {
    return { execution: null, tasks: [], events: [] };
  }
}

/** Aggregates for the Execution panel inside the Reality Center. */
export async function executionOverview(limit = 100) {
  try {
    const { data } = await db()
      .from("executions")
      .select("id, goal, mode, status, outcome_score, reality_state, cost_usd, tokens, approval_required, approved_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = (data as any[]) || [];
    const byStatus: Record<string, number> = {};
    const byMode: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byMode[r.mode] = (byMode[r.mode] || 0) + 1;
    }
    const scored = rows.filter((r) => r.outcome_score != null);
    return {
      total: rows.length,
      by_status: byStatus,
      by_mode: byMode,
      avg_outcome: scored.length ? Math.round(scored.reduce((a, r) => a + Number(r.outcome_score || 0), 0) / scored.length) : 0,
      total_cost_usd: Number(rows.reduce((a, r) => a + Number(r.cost_usd || 0), 0).toFixed(4)),
      awaiting_approval: rows.filter((r) => r.approval_required && !r.approved_at).length,
      recent: rows.slice(0, 20),
    };
  } catch {
    return { total: 0, by_status: {}, by_mode: {}, avg_outcome: 0, total_cost_usd: 0, awaiting_approval: 0, recent: [] as any[] };
  }
}
