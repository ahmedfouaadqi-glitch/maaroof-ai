// Agent Factory — registry helpers for Maaroof (Part 3).
// Evolves the existing orchestrator: instead of implicit per-run agents,
// each run is bound to a `maaroof_agents` row (DNA + lifecycle + versioning).
// Backward compatible: when agent_factory is disabled or no row is created,
// the orchestrator falls back to the pre-existing behavior.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export type AgentDNA = {
  capabilities?: string[];
  preferred_experts?: string[];
  preferred_models?: string[];
  preferred_mcp?: string[];
  decision_style?: string;
  thinking_style?: string;
  communication_style?: string;
  cost_profile?: string;
  learning_profile?: string;
};

export type MaaroofAgent = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  parent_agent_id: string | null;
  role: string;
  mission: string | null;
  dna: AgentDNA;
  version: number;
  lifecycle_state: string;
  success_rate: number | null;
  runs_count: number;
  confidence: Record<string, unknown>;
  cost_breakdown: Record<string, unknown>;
  last_run_id: string | null;
};

/** Pick a warm (standby) agent whose DNA covers the required capabilities.
 * Returns null if none matches or reuse is disabled. */
export async function pickWarmAgent(opts: {
  userId: string;
  workspaceId?: string | null;
  capabilities: string[];
  minSuccessRate?: number;
}): Promise<MaaroofAgent | null> {
  try {
    let q = db()
      .from("maaroof_agents")
      .select("*")
      .eq("user_id", opts.userId)
      .eq("lifecycle_state", "standby")
      .order("success_rate", { ascending: false, nullsFirst: false })
      .limit(5);
    if (opts.workspaceId) q = q.eq("workspace_id", opts.workspaceId);
    const { data } = await q;
    const rows = (data as MaaroofAgent[]) || [];
    const needed = new Set(opts.capabilities.filter(Boolean));
    for (const row of rows) {
      const dnaCaps = new Set((row.dna?.capabilities as string[]) || []);
      const covers = [...needed].every((c) => dnaCaps.has(c));
      const ok = row.success_rate == null || row.success_rate >= (opts.minSuccessRate ?? 0);
      if (covers && ok) return row;
    }
    return null;
  } catch {
    return null;
  }
}

/** Create a new agent row (v1). */
export async function createAgent(opts: {
  userId: string;
  workspaceId?: string | null;
  role: string;
  mission?: string;
  dna: AgentDNA;
  parentAgentId?: string | null;
}): Promise<MaaroofAgent | null> {
  try {
    const { data } = await db()
      .from("maaroof_agents")
      .insert({
        user_id: opts.userId,
        workspace_id: opts.workspaceId || null,
        parent_agent_id: opts.parentAgentId || null,
        role: opts.role,
        mission: opts.mission || null,
        dna: opts.dna || {},
        lifecycle_state: "initialized",
      })
      .select("*")
      .single();
    return (data as MaaroofAgent) || null;
  } catch {
    return null;
  }
}

/** Reuse or create in one call. */
export async function getOrCreateAgent(opts: {
  userId: string;
  workspaceId?: string | null;
  role: string;
  mission?: string;
  dna: AgentDNA;
  warmReuse: boolean;
  minSuccessRate?: number;
}): Promise<{ agent: MaaroofAgent | null; reused: boolean }> {
  if (opts.warmReuse) {
    const warm = await pickWarmAgent({
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      capabilities: opts.dna.capabilities || [],
      minSuccessRate: opts.minSuccessRate,
    });
    if (warm) {
      await updateLifecycle(warm.id, "reactivated");
      return { agent: warm, reused: true };
    }
  }
  const created = await createAgent(opts);
  return { agent: created, reused: false };
}

/** Move an agent to a new lifecycle state (audit-logged via updated_at). */
export async function updateLifecycle(agentId: string, state: string): Promise<void> {
  try {
    await db().from("maaroof_agents").update({ lifecycle_state: state }).eq("id", agentId);
  } catch {}
}

/** Bump version and merge new DNA/mission bits (v1 -> v2 -> ...). */
export async function bumpVersion(agentId: string, patch: Partial<Pick<MaaroofAgent, "dna" | "mission" | "role">>): Promise<void> {
  try {
    const { data } = await db().from("maaroof_agents").select("version, dna").eq("id", agentId).maybeSingle();
    const version = ((data as any)?.version || 1) + 1;
    const dna = { ...((data as any)?.dna || {}), ...(patch.dna || {}) };
    await db().from("maaroof_agents").update({ version, dna, mission: patch.mission, role: patch.role }).eq("id", agentId);
  } catch {}
}

/** Finalize an agent at the end of a run: metrics + next lifecycle state. */
export async function finalizeAgent(opts: {
  agentId: string;
  runId: string;
  success: boolean;
  confidence: Record<string, unknown>;
  costBreakdown: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data } = await db()
      .from("maaroof_agents")
      .select("runs_count, success_rate")
      .eq("id", opts.agentId)
      .maybeSingle();
    const prevCount = Number((data as any)?.runs_count || 0);
    const prevRate = Number((data as any)?.success_rate || 0);
    const newCount = prevCount + 1;
    // Exponential-ish rolling success rate.
    const successVal = opts.success ? 1 : 0;
    const newRate = prevCount === 0 ? successVal : (prevRate * prevCount + successVal) / newCount;
    await db()
      .from("maaroof_agents")
      .update({
        runs_count: newCount,
        success_rate: Number(newRate.toFixed(4)),
        confidence: opts.confidence || {},
        cost_breakdown: opts.costBreakdown || {},
        last_run_id: opts.runId,
        lifecycle_state: opts.success ? "standby" : "archived",
      })
      .eq("id", opts.agentId);
  } catch {}
}
