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

/** Part 8 — Laws of Cognitive Intelligence (compliance layer). All OFF by
 *  default so the Part 7 execution path stays byte-identical. */
export type LawsSettings = {
  /** Master toggle: evaluate the 30 laws against each run's signals. */
  enabled: boolean;
  /** Inject the laws block into the system prompt. */
  prompt_injection: boolean;
  /** Block/flag the final answer when a hard law is broken. */
  enforce_hard_laws: boolean;
  /** Minimum council confidence (0-100) required by Law 13. */
  min_trust: number;
  /** Persist the compliance envelope into maaroof_runs.compliance. */
  log_compliance: boolean;
};

/** Parts 9 & 10 — Expert Learning Engine + Learning Governance. */
export type ExpertsSettings = {
  /** Master switch for the cognitive-interview learning engine. */
  enabled: boolean;
  /** Inject learned expert snapshots into the planner prompt. */
  use_snapshots: boolean;
  /** Model used for learning sessions (charged to the system budget only). */
  learning_model: string;
  /** Re-learn automatically when a tool definition changes. */
  auto_relearn_on_change: boolean;
  /** Hard ceiling on monthly learning spend, in USD. */
  monthly_budget_usd: number;
  /** Skip planning an expert whose understanding score is below this. */
  min_understanding: number;
};

/** Part 11 — Living Knowledge Ecosystem. */
export type KnowledgeSettings = {
  enabled: boolean;
  /** Write knowledge nodes from finished runs. */
  capture_enabled: boolean;
  /** Read the graph back into the planner prompt. */
  recall_enabled: boolean;
  /** Days after which a node is treated as stale. */
  freshness_days: number;
  /** Minimum confidence for a node to be recalled. */
  min_confidence: number;
};

/** Part 12 — AI Model Governance & Evolution. */
export type ModelGovernanceSettings = {
  /** Master switch. OFF => planner_model/fallback_model are used verbatim. */
  enabled: boolean;
  /** Pick a model per decision phase instead of one model per run. */
  per_phase_selection: boolean;
  /** Record success/failure/latency per model. */
  health_tracking: boolean;
  /** Allow Maaroof to file upgrade proposals for admin approval. */
  auto_proposals: boolean;
  /** Allow admin-triggered benchmark runs. */
  benchmark_enabled: boolean;
  /** Use registry prices instead of the hardcoded estimate. */
  use_registry_pricing: boolean;
};

/** Part 13 — Executive Decision Intelligence. */
export type DecisionSettings = {
  enabled: boolean;
  /** Persist the 20-stage pipeline into decision_traces. */
  trace_enabled: boolean;
  /** Compare 2-3 candidate plans on quality/cost/time before executing. */
  cost_aware_alternatives: boolean;
  /** Compute and store a Decision Score for each run. */
  score_enabled: boolean;
};


/** Part 14 — Executive Publishing Ecosystem. */
export type PublishingSettings = {
  enabled: boolean;
  /** Build a per-platform publication strategy instead of one shared post. */
  strategy_enabled: boolean;
  /** Group publications into campaigns with budgets. */
  campaigns_enabled: boolean;
  /** Default approval mode when the campaign/workspace does not set one. */
  default_approval_mode: string;
  /** Allow scheduled auto-publishing without a human in the loop. */
  auto_publish_enabled: boolean;
  /** Collect reach/engagement metrics after publishing. */
  metrics_enabled: boolean;
  /** Hard cap of publications per user per day. */
  daily_publication_cap: number;
};

/** Part 15 — Executive Trust Architecture. */
export type TrustEngineSettings = {
  enabled: boolean;
  /** Run the 13-stage trust pipeline on every answer. */
  pipeline_enabled: boolean;
  /** Persist per-entity trust profiles and events. */
  profiles_enabled: boolean;
  /** Compute the executive decision score (value/impact/ROI). */
  executive_score_enabled: boolean;
  /** Below this, the answer is labelled as needing human verification. */
  min_trust: number;
  /** Surface weak links (low-trust experts/models/tools) to the admin. */
  weak_link_alerts: boolean;
};

/** Part 16 — Living State Anchor. */
export type StateAnchorSettings = {
  enabled: boolean;
  /** Validate identity/mission/goal/budget before every run. */
  validate_before_execution: boolean;
  /** Measure drift across goal, language, workspace, trust, memory, execution. */
  drift_detection: boolean;
  /** Persist every state change to the timeline. */
  timeline_enabled: boolean;
  /** Allow resuming from the last healthy rollback point. */
  recovery_enabled: boolean;
  /** Severity at or above which a drift is treated as blocking. */
  drift_threshold: number;
};

/** Part 17 — HERMES executive steward. */
export type HermesSettings = {
  enabled: boolean;
  /** Derive proposals from measured platform signals. */
  proposals_enabled: boolean;
  /** Evolve Founder DNA from real approve/reject decisions. */
  founder_dna_enabled: boolean;
  /** Founder-only conversational office. */
  office_enabled: boolean;
  /** Model used in the office; steward cost is charged to the system budget. */
  office_model: string;
  /** HERMES never executes in production without an explicit approval. */
  never_execute_without_approval: boolean;
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
  laws: LawsSettings;
  experts: ExpertsSettings;
  knowledge: KnowledgeSettings;
  model_governance: ModelGovernanceSettings;
  decision: DecisionSettings;
  publishing: PublishingSettings;
  trust_engine: TrustEngineSettings;
  state_anchor: StateAnchorSettings;
  hermes: HermesSettings;


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
  laws: {
    enabled: false,
    prompt_injection: false,
    enforce_hard_laws: false,
    min_trust: 55,
    log_compliance: true,
  },
  experts: {
    enabled: false,
    use_snapshots: false,
    learning_model: "google/gemini-2.5-flash",
    auto_relearn_on_change: false,
    monthly_budget_usd: 5,
    min_understanding: 0,
  },
  knowledge: {
    enabled: false,
    capture_enabled: false,
    recall_enabled: false,
    freshness_days: 30,
    min_confidence: 40,
  },
  model_governance: {
    enabled: false,
    per_phase_selection: false,
    health_tracking: true,
    auto_proposals: false,
    benchmark_enabled: false,
    use_registry_pricing: false,
  },
  decision: {
    enabled: false,
    trace_enabled: false,
    cost_aware_alternatives: false,
    score_enabled: false,
  },
  publishing: {
    enabled: false,
    strategy_enabled: true,
    campaigns_enabled: true,
    default_approval_mode: "always_ask",
    auto_publish_enabled: false,
    metrics_enabled: true,
    daily_publication_cap: 20,
  },
  trust_engine: {
    enabled: false,
    pipeline_enabled: true,
    profiles_enabled: true,
    executive_score_enabled: true,
    min_trust: 55,
    weak_link_alerts: true,
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
