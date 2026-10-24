// Part 7 — Executive Digital Genome.
// A read/merge VIEW over columns that already exist (workspaces.*,
// maaroof_agents.dna/personality). No new table: the genome is the durable
// identity the platform already stores, exposed through one typed surface.
// Identity fields are write-protected once set unless `force` is passed.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

/** Fields that define identity and must not silently drift. */
const PROTECTED_KEYS = ["identity", "vision", "values", "brand_voice"];

export type WorkspaceGenome = {
  scope: "workspace";
  id: string;
  name: string | null;
  kind: string | null;
  profile: Record<string, any>;
  goals: any;
  policies: Record<string, any>;
  success_metrics: any;
  preferred_experts: any;
  preferred_models: any;
  preferred_mcp: any;
  risk_level: string | null;
  budget: Record<string, any>;
  memory_count: number;
  runs_count: number;
};

export type AgentGenome = {
  scope: "agent";
  id: string;
  role: string;
  mission: string | null;
  dna: Record<string, any>;
  personality: Record<string, number>;
  personality_version: number;
  version: number;
  runs_count: number;
  success_rate: number | null;
};

export async function readWorkspaceGenome(workspaceId: string): Promise<WorkspaceGenome | null> {
  try {
    const { data } = await db()
      .from("workspaces")
      .select("id, name, kind, profile, goals, policies, success_metrics, preferred_experts, preferred_models, preferred_mcp, risk_level, budget")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!data) return null;
    const [{ count: memory_count }, { count: runs_count }] = await Promise.all([
      db().from("maaroof_memory").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      db().from("maaroof_runs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ]);
    return {
      scope: "workspace",
      id: (data as any).id,
      name: (data as any).name ?? null,
      kind: (data as any).kind ?? null,
      profile: (data as any).profile || {},
      goals: (data as any).goals || [],
      policies: (data as any).policies || {},
      success_metrics: (data as any).success_metrics || [],
      preferred_experts: (data as any).preferred_experts || [],
      preferred_models: (data as any).preferred_models || [],
      preferred_mcp: (data as any).preferred_mcp || [],
      risk_level: (data as any).risk_level ?? null,
      budget: (data as any).budget || {},
      memory_count: memory_count || 0,
      runs_count: runs_count || 0,
    };
  } catch {
    return null;
  }
}

export async function readAgentGenome(agentId: string): Promise<AgentGenome | null> {
  try {
    const { data } = await db()
      .from("maaroof_agents")
      .select("id, role, mission, dna, personality, personality_version, version, runs_count, success_rate")
      .eq("id", agentId)
      .maybeSingle();
    if (!data) return null;
    const d: any = data;
    return {
      scope: "agent",
      id: d.id,
      role: d.role,
      mission: d.mission ?? null,
      dna: d.dna || {},
      personality: d.personality || {},
      personality_version: d.personality_version || 1,
      version: d.version || 1,
      runs_count: d.runs_count || 0,
      success_rate: d.success_rate ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Additive merge into a workspace genome's `profile`. Protected identity keys
 * are only overwritten when `force` is true (admin override).
 */
export async function mergeWorkspaceGenome(opts: {
  workspaceId: string;
  patch: Record<string, any>;
  force?: boolean;
}): Promise<boolean> {
  try {
    const { data } = await db().from("workspaces").select("profile").eq("id", opts.workspaceId).maybeSingle();
    const prev = ((data as any)?.profile as Record<string, any>) || {};
    const next = { ...prev };
    for (const [k, v] of Object.entries(opts.patch || {})) {
      if (v == null) continue;
      if (PROTECTED_KEYS.includes(k) && prev[k] != null && !opts.force) continue;
      next[k] = v;
    }
    await db().from("workspaces").update({ profile: next }).eq("id", opts.workspaceId);
    return true;
  } catch {
    return false;
  }
}

/** Compact prompt block so the genome actually shapes behaviour. */
export function genomePromptBlock(g: WorkspaceGenome | null): string {
  if (!g) return "";
  const bits: string[] = [];
  if (g.name) bits.push(`Genome: ${g.name} (${g.kind || "brand"})`);
  if (g.profile && Object.keys(g.profile).length) bits.push(`Identity: ${JSON.stringify(g.profile).slice(0, 500)}`);
  if (g.risk_level) bits.push(`Risk appetite: ${g.risk_level}`);
  if (g.budget && Object.keys(g.budget).length) bits.push(`Budget: ${JSON.stringify(g.budget).slice(0, 200)}`);
  bits.push(`History: ${g.runs_count} runs, ${g.memory_count} memories`);
  return bits.length ? `\n\n[Executive digital genome]\n${bits.join("\n")}` : "";
}
