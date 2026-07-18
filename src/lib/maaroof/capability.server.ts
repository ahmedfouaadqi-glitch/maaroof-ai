// Capability Operating System (Part 4) — evolves the Capability Registry
// with live scoring, graph discovery, and implementation choice.
// Non-breaking: when the aggregate view is empty or the setting is off, the
// orchestrator falls back to the static tool-catalog picker (Part 3).
import { createClient } from "@supabase/supabase-js";
import {
  TOOL_CATALOG,
  findExpertsByCapability,
  pickExpertForCapability,
  listCapabilities,
  type Capability,
  type ToolDef,
} from "@/lib/tool-catalog";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export type CapabilityScore = {
  capability: Capability;
  runs: number;
  success_rate: number | null; // 0..1
  avg_usd: number | null;
  avg_tokens: number | null;
  last_used_at: string | null;
  top_tool: string | null;
};

export type CapabilityChoice = {
  capability: Capability;
  expert: ToolDef;
  score: number; // 0..1 composite
  reason: string;
  alternatives: Array<{ key: string; score: number }>;
};

export type CapabilityGraphNode = {
  capability: Capability;
  experts: string[];
  runs: number;
  success_rate: number | null;
  avg_usd: number | null;
};

/** Load aggregate metrics from the `capability_scores_v` view. Safe on empty DB. */
export async function loadCapabilityScores(): Promise<Record<string, CapabilityScore>> {
  try {
    const { data } = await db().from("capability_scores_v").select("*");
    const out: Record<string, CapabilityScore> = {};
    for (const row of (data as any[]) || []) {
      out[row.capability] = {
        capability: row.capability,
        runs: Number(row.runs || 0),
        success_rate: row.success_rate == null ? null : Number(row.success_rate),
        avg_usd: row.avg_usd == null ? null : Number(row.avg_usd),
        avg_tokens: row.avg_tokens == null ? null : Number(row.avg_tokens),
        last_used_at: row.last_used_at || null,
        top_tool: row.top_tool || null,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Build a lightweight capability→experts graph for UI + SSE. */
export function buildCapabilityGraph(scores: Record<string, CapabilityScore>): CapabilityGraphNode[] {
  const caps = listCapabilities();
  return caps.map((cap) => {
    const experts = findExpertsByCapability(cap).map((t) => t.key);
    const s = scores[cap];
    return {
      capability: cap,
      experts,
      runs: s?.runs ?? 0,
      success_rate: s?.success_rate ?? null,
      avg_usd: s?.avg_usd ?? null,
    };
  });
}

/** Score an expert for a capability using static DNA + live metrics.
 * Weighted: quality 0.4, success 0.3, cost inverse 0.2, latency inverse 0.1. */
function scoreExpert(expert: ToolDef, live: CapabilityScore | undefined): number {
  const quality = (expert.avgQuality ?? 70) / 100; // 0..1
  const success = live?.success_rate ?? 0.7;
  const usd = live?.avg_usd ?? 0.01;
  const costInv = 1 / (1 + usd * 100); // cheaper → closer to 1
  const latency = expert.avgLatencyMs ?? 2000;
  const latInv = 1 / (1 + latency / 5000);
  return Number((quality * 0.4 + success * 0.3 + costInv * 0.2 + latInv * 0.1).toFixed(4));
}

/** Pick the best implementation for a capability given constraints + live scores.
 * Falls back to the static picker when no metrics exist. */
export function chooseImplementation(opts: {
  capability: Capability;
  scores: Record<string, CapabilityScore>;
  preferredExperts?: string[];
  maxRiskLevel?: "low" | "medium" | "high";
  costCeilingUsd?: number;
}): CapabilityChoice | null {
  const cands = findExpertsByCapability(opts.capability);
  if (!cands.length) return null;

  const risk = { low: 1, medium: 2, high: 3 } as const;
  const maxRisk = opts.maxRiskLevel ? risk[opts.maxRiskLevel] : 3;
  const live = opts.scores[opts.capability];

  const filtered = cands.filter((t) => {
    const tr = t.riskLevel ? risk[t.riskLevel] : 2;
    if (tr > maxRisk) return false;
    if (opts.costCeilingUsd != null && live?.avg_usd != null && live.avg_usd > opts.costCeilingUsd) {
      // ceiling is a soft cap: still allow if this specific expert is cheaper than avg
      if ((t.costProfile || "medium") === "heavy") return false;
    }
    return true;
  });
  const pool = filtered.length ? filtered : cands;

  const ranked = pool
    .map((t) => {
      const preferred = opts.preferredExperts?.includes(t.key) ? 0.05 : 0;
      return { tool: t, score: Math.min(1, scoreExpert(t, live) + preferred) };
    })
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  if (!winner) return pickExpertForCapability(opts.capability)
    ? { capability: opts.capability, expert: pickExpertForCapability(opts.capability)!, score: 0.5, reason: "fallback:no-scores", alternatives: [] }
    : null;

  const reason = live
    ? `runs=${live.runs}, success=${((live.success_rate ?? 0) * 100).toFixed(0)}%, avg$=${(live.avg_usd ?? 0).toFixed(4)}`
    : "no-live-metrics, using DNA baseline";

  return {
    capability: opts.capability,
    expert: winner.tool,
    score: winner.score,
    reason,
    alternatives: ranked.slice(1, 4).map((r) => ({ key: r.tool.key, score: r.score })),
  };
}

/** Convenience: list all capabilities declared by tool DNA. */
export { listCapabilities };

/** Tool-catalog helper re-export so callers only import from this module. */
export { TOOL_CATALOG };
