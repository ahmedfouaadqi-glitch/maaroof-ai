// Maaroof dynamic settings — cached for 60s. Read by orchestrator + api/maaroof.
import { createClient } from "@supabase/supabase-js";

export type CouncilSettings = {
  /** Turn the Expert Council deliberation phase on/off (default: on). */
  enabled: boolean;
  /** Max experts consulted in one run. */
  max_experts: number;
  /** If true, council writes each opinion into maaroof_runs.decision_log. */
  log_decisions: boolean;
  /**
   * Future-Driven "envision" phase (Part 2). When true, orchestrator runs a
   * brief envision() step before plan() to derive a future_goal + backward_chain.
   * Kill-switching this returns behaviour to Part 1 exactly.
   */
  envision_enabled?: boolean;
  /** Persist Learning DNA to memory kind=learning after each run. */
  learning_enabled?: boolean;
};

export type AgentFactorySettings = {
  /** Master toggle for the Agent Factory (warm reuse + versioning). When false, orchestrator behaves as before. */
  enabled: boolean;
  /** Reuse standby agents whose success_rate >= threshold instead of creating a new one. */
  warm_reuse_enabled: boolean;
  /** Minimum council confidence (0-100) before Maaroof emits a needs_human event. */
  min_confidence: number;
};

/** Part 4 — Capability Operating System toggles. Additive; defaults preserve Part 3. */
export type CapabilityOsSettings = {
  /** Master toggle. When false, the orchestrator uses static tool-catalog picking. */
  enabled: boolean;
  /** Use `capability_scores_v` metrics to score implementations. */
  scoring_enabled: boolean;
  /** Emit the `graph` SSE event for the UI. */
  graph_enabled: boolean;
  /** Consult the mcp_providers registry when a capability declares mcp binding. */
  mcp_registry_enabled: boolean;
};

/** Part 5 — Cognitive Intelligence Platform toggles. Additive; defaults preserve Part 4. */
export type CognitiveSettings = {
  /** Master toggle for the Cognitive Intelligence Engine. */
  enabled: boolean;
  /** Extract anonymized Platform DNA at the end of each successful run. */
  dna_enabled: boolean;
  /** Enable peer/expert post-run review on top of self-review. */
  peer_review_enabled: boolean;
  /** Generate periodic Evolution Reports (week/month/quarter). */
  evolution_reports_enabled: boolean;
};

/** Part 6 — Platform Evolution toggles. Additive; defaults preserve Part 5. */
export type PlatformEvolutionSettings = {
  /** Advanced Future Decision Simulator axes (market/competitors/costs/…). */
  simulation_engine_enabled: boolean;
  /** Three-way execution mode switch: simulation / recommendation / execution. */
  execution_modes_enabled: boolean;
  /** Workflow Graph interpreter (branches/loops/approvals). */
  workflow_graph_enabled: boolean;
  /** Emit Executive Quality Score (11 dims) into maaroof_runs.quality_score. */
  quality_score_enabled: boolean;
  /** Capability Marketplace admin surface + preferred implementation pins. */
  capability_marketplace_enabled: boolean;
};

/** Part 7 — Executive Intelligence toggles. Additive; all default OFF so the
 *  Part 6 execution path is preserved byte-for-byte until an admin opts in. */
export type ExecutiveSettings = {
  /** Master toggle for the whole Part 7 layer. */
  enabled: boolean;
  /** Evolve per-agent executive personality traits after each run. */
  personality_enabled: boolean;
  /** Cognitive Conflict Engine — extra deliberation ONLY when the council disagrees. */
  conflict_enabled: boolean;
  /** Strategic Time Engine — execute_now / delay / schedule / observe / cancel. */
  timing_enabled: boolean;
  /** Trust Engine — structured evidence/assumptions/limitations envelope. */
  trust_enabled: boolean;
  /** Executive Digital Genome read/merge on workspace + agent. */
  genome_enabled: boolean;
  /** Emit anonymized `future_dna` rows for both successful and failed runs. */
  future_dna_enabled: boolean;
  /** Confidence spread (0-100) above which the council is treated as conflicted. */
  conflict_threshold: number;
};

export type MaaroofSettings = {
  trial_daily_cap: number;
  tool_timeout_ms: number;
  max_steps: number;
  max_goal_chars: number;
  planner_model: string;
  fallback_model: string;
  enabled_tools: string[];
  system_prompt_extra: string;
  kill_switch: boolean;
  council: CouncilSettings;
  agent_factory: AgentFactorySettings;
  capability_os: CapabilityOsSettings;
  cognitive: CognitiveSettings;
  platform_evolution: PlatformEvolutionSettings;
  executive: ExecutiveSettings;
};

const DEFAULTS: MaaroofSettings = {
  trial_daily_cap: 5,
  tool_timeout_ms: 45000,
  max_steps: 12,
  max_goal_chars: 2000,
  planner_model: "google/gemini-2.5-pro",
  fallback_model: "google/gemini-2.5-flash",
  enabled_tools: [
    "suggest","geo_rewrite","analyze","research","feasibility","bizdev",
    "brand_boost","what_if","applied_ranking","visibility","social_analysis",
    "compare","company_email","geo_strategist","competitor_monitor","brand_authority",
  ],
  system_prompt_extra: "",
  kill_switch: false,
  council: { enabled: true, max_experts: 3, log_decisions: true, envision_enabled: true, learning_enabled: true },
  agent_factory: { enabled: true, warm_reuse_enabled: true, min_confidence: 40 },
  capability_os: { enabled: true, scoring_enabled: true, graph_enabled: true, mcp_registry_enabled: false },
  cognitive: { enabled: true, dna_enabled: true, peer_review_enabled: false, evolution_reports_enabled: true },
  platform_evolution: {
    simulation_engine_enabled: false,
    execution_modes_enabled: false,
    workflow_graph_enabled: false,
    quality_score_enabled: false,
    capability_marketplace_enabled: false,
  },
  executive: {
    enabled: false,
    personality_enabled: false,
    conflict_enabled: false,
    timing_enabled: false,
    trust_enabled: false,
    genome_enabled: false,
    future_dna_enabled: false,
    conflict_threshold: 25,
  },
};

let _cache: { at: number; value: MaaroofSettings } | null = null;
const TTL_MS = 60_000;

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return _db;
}

export async function getMaaroofSettings(force = false): Promise<MaaroofSettings> {
  if (!force && _cache && Date.now() - _cache.at < TTL_MS) return _cache.value;
  try {
    const { data } = await db().from("maaroof_settings").select("key, value");
    const out: any = { ...DEFAULTS };
    for (const row of (data as any[]) || []) {
      if (row.key in DEFAULTS) out[row.key] = row.value;
    }
    _cache = { at: Date.now(), value: out as MaaroofSettings };
    return out as MaaroofSettings;
  } catch {
    return DEFAULTS;
  }
}

export function invalidateMaaroofSettings() { _cache = null; }
