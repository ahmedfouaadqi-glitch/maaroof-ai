// Part 13 — Executive Decision Intelligence (Decision Constitution).
//
// Evolution, not replacement: `maaroof_runs.decision_log` keeps holding the
// council transcript exactly as before. This module adds the missing layer —
// a structured, auditable, replayable trace of the 20-stage decision pipeline,
// with rejected alternatives and a decision score. Writing is best-effort and
// fully gated: when `decision.trace_enabled` is false nothing is recorded and
// the run behaves identically to before.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

/** The 20 stages of the decision pipeline (Part 13). */
export const DECISION_STAGES = [
  "goal_understanding",
  "context_analysis",
  "workspace_analysis",
  "user_analysis",
  "knowledge_analysis",
  "memory_analysis",
  "expert_selection",
  "capability_selection",
  "tool_selection",
  "mcp_selection",
  "model_selection",
  "risk_analysis",
  "cost_analysis",
  "time_analysis",
  "future_impact",
  "execution_strategy",
  "validation",
  "approval",
  "execution",
  "learning",
] as const;
export type DecisionStage = (typeof DECISION_STAGES)[number];

export type TraceInput = {
  stage: DecisionStage;
  summary?: string;
  payload?: Record<string, any>;
  experts?: any[];
  capabilities?: any[];
  tools?: any[];
  models?: any[];
  mcp?: any[];
  /** Rejected options: [{ option, reason }] — the audit backbone of Part 13. */
  alternatives?: Array<{ option: string; reason: string; cost_usd?: number; score?: number }>;
  cost_usd?: number;
  risk?: number;
  duration_ms?: number;
  confidence?: number;
};

export type DecisionAlternative = {
  label: string;
  quality: number; // 0-100
  cost_usd: number;
  minutes: number;
};

/**
 * Collects the decision pipeline for one run and flushes it to
 * `decision_traces`. Safe to construct even when tracing is disabled.
 */
export class DecisionTracer {
  private rows: any[] = [];
  private seq = 0;

  constructor(
    private readonly opts: {
      enabled: boolean;
      runId: string;
      userId: string;
      workspaceId?: string | null;
      emit?: (event: string, data: any) => Promise<void>;
    },
  ) {}

  get enabled() {
    return this.opts.enabled;
  }

  /** Record one pipeline stage. No-op when tracing is off. */
  async trace(input: TraceInput): Promise<void> {
    if (!this.opts.enabled) return;
    const row = {
      run_id: this.opts.runId,
      user_id: this.opts.userId,
      workspace_id: this.opts.workspaceId || null,
      stage: input.stage,
      seq: this.seq++,
      summary: (input.summary || "").slice(0, 600) || null,
      payload: input.payload || {},
      experts: input.experts || [],
      capabilities: input.capabilities || [],
      tools: input.tools || [],
      models: input.models || [],
      mcp: input.mcp || [],
      alternatives: input.alternatives || [],
      cost_usd: Number(input.cost_usd || 0),
      risk: input.risk ?? null,
      duration_ms: input.duration_ms ?? null,
      confidence: input.confidence ?? null,
      score: null as number | null,
    };
    this.rows.push(row);
    try {
      await this.opts.emit?.("decision", {
        stage: row.stage,
        seq: row.seq,
        summary: row.summary,
        alternatives: row.alternatives,
        models: row.models,
        cost_usd: row.cost_usd,
        confidence: row.confidence,
      });
    } catch {}
    try {
      await db().from("decision_traces").insert(row);
    } catch {
      /* tracing must never break a run */
    }
  }

  /** Snapshot of everything traced so far (used for scoring + the run summary). */
  snapshot() {
    return this.rows.map((r) => ({
      stage: r.stage,
      seq: r.seq,
      summary: r.summary,
      alternatives: r.alternatives,
      models: r.models,
      cost_usd: r.cost_usd,
      confidence: r.confidence,
    }));
  }

  /**
   * Decision Score — deterministic, zero extra LLM cost.
   * Rewards coverage of the pipeline, explicit alternatives, stated confidence
   * and cost awareness.
   */
  score(): { score: number; coverage: number; explained: number } {
    if (!this.rows.length) return { score: 0, coverage: 0, explained: 0 };
    const covered = new Set(this.rows.map((r) => r.stage)).size;
    const coverage = Math.round((covered / DECISION_STAGES.length) * 100);
    const withAlts = this.rows.filter((r) => (r.alternatives || []).length > 0).length;
    const explained = Math.round((withAlts / this.rows.length) * 100);
    const confs = this.rows.map((r) => r.confidence).filter((c: any) => typeof c === "number");
    const avgConf = confs.length ? confs.reduce((a: number, b: number) => a + b, 0) / confs.length : 50;
    const costAware = this.rows.some((r) => Number(r.cost_usd) > 0) ? 100 : 60;
    const score = Math.round(coverage * 0.4 + explained * 0.25 + avgConf * 0.2 + costAware * 0.15);
    return { score: Math.max(0, Math.min(100, score)), coverage, explained };
  }
}

/**
 * Cost-aware decision (Part 13): compare candidate execution plans on
 * quality / cost / time and return the winner plus the rejected options with
 * their reasons. Deterministic — no model call.
 */
export function chooseAlternative(
  options: DecisionAlternative[],
  weights: { quality?: number; cost?: number; time?: number } = {},
): { chosen: DecisionAlternative; rejected: Array<{ option: string; reason: string; cost_usd: number; score: number }>; reason: string } | null {
  if (!options.length) return null;
  const w = { quality: weights.quality ?? 0.55, cost: weights.cost ?? 0.3, time: weights.time ?? 0.15 };
  const maxCost = Math.max(...options.map((o) => o.cost_usd), 0.000001);
  const maxTime = Math.max(...options.map((o) => o.minutes), 0.0001);
  const scored = options.map((o) => ({
    o,
    s: w.quality * (o.quality / 100) + w.cost * (1 - o.cost_usd / maxCost) + w.time * (1 - o.minutes / maxTime),
  }));
  scored.sort((a, b) => b.s - a.s);
  const win = scored[0];
  return {
    chosen: win.o,
    rejected: scored.slice(1).map((r) => ({
      option: r.o.label,
      reason:
        r.o.cost_usd > win.o.cost_usd
          ? `تكلفة أعلى (${r.o.cost_usd.toFixed(4)}$ مقابل ${win.o.cost_usd.toFixed(4)}$) دون مكسب جودة كافٍ.`
          : r.o.quality < win.o.quality
            ? `جودة متوقعة أقل (${r.o.quality} مقابل ${win.o.quality}).`
            : `توازن أضعف بين الجودة والوقت (${r.o.minutes} دقيقة).`,
      cost_usd: r.o.cost_usd,
      score: Number(r.s.toFixed(3)),
    })),
    reason: `اختيار «${win.o.label}» بأفضل توازن جودة/تكلفة/وقت (نقاط ${win.s.toFixed(3)}).`,
  };
}
