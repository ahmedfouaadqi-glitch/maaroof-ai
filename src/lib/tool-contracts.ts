import { TOOL_CATALOG, type ToolKey } from "@/lib/tool-catalog";
import { TOOL_OPTIONS, type ToolOptions } from "@/lib/tool-options";

/**
 * Canonical execution classification for every ToolKey.
 *
 * This registry owns execution state and route identity. TOOL_OPTIONS remains
 * planner-facing input metadata; it is not a runtime schema/field allowlist.
 */
export type ToolExecutionKind = "api" | "internal" | "coordinator" | "agent_only";
export type ToolAvailability = "active" | "paused" | "special";
export type ToolAuthorizationOwner = "route" | "orchestrator" | "none";
export type ToolBillingOwner = "route" | "orchestrator" | "none";
export type ToolOutputContract = {
  /** known uses a successful SSE result event; errors are still JSON. */
  transport: "json" | "sse" | "internal";
  successKind: "top_level_object" | "result_envelope" | "event_stream" | "paused_response";
  /** Stable top-level fields observed in the route success response. */
  successFields: string[];
  errorField: "error";
};

const API_OUTPUTS: Partial<Record<ToolKey, ToolOutputContract>> = {
  analyze: { transport: "json", successKind: "top_level_object", successFields: ["score", "authority", "local", "citation", "ai_view", "strengths", "weaknesses", "recommendations", "keywords", "platform_views", "explain", "cached"], errorField: "error" },
  suggest: { transport: "json", successKind: "top_level_object", successFields: ["post", "sources", "council"], errorField: "error" },
  compare: { transport: "json", successKind: "result_envelope", successFields: ["ok", "result", "sources"], errorField: "error" },
  known: { transport: "sse", successKind: "event_stream", successFields: ["run_id", "brand", "engine_answers", "engine_status", "relations", "sources"], errorField: "error" },
  feasibility: { transport: "json", successKind: "result_envelope", successFields: ["ok", "result", "sources"], errorField: "error" },
  bizdev: { transport: "json", successKind: "result_envelope", successFields: ["ok", "result", "sources"], errorField: "error" },
  research: { transport: "json", successKind: "top_level_object", successFields: ["query", "sge_summary", "answer", "key_findings", "visibility_opportunities", "sources", "channels", "sources_used", "rarity_score", "evidence_missing"], errorField: "error" },
  visibility: { transport: "json", successKind: "result_envelope", successFields: ["ok", "operation_id", "taskId", "result", "probe", "sources"], errorField: "error" },
  brand_boost: { transport: "json", successKind: "top_level_object", successFields: ["operation_id", "summary", "analysis_status", "analysis_limitations", "website_scan", "evidence", "plan", "engines"], errorField: "error" },
  company_email: { transport: "json", successKind: "top_level_object", successFields: ["mode", "sources", "specialty"], errorField: "error" },
  applied_ranking: { transport: "json", successKind: "result_envelope", successFields: ["ok", "result"], errorField: "error" },
  geo_strategist: { transport: "json", successKind: "top_level_object", successFields: ["id", "horizon", "timeframe", "realism_note", "sources"], errorField: "error" },
  competitor_monitor: { transport: "internal", successKind: "paused_response", successFields: ["skipped"], errorField: "error" },
  social_analysis: { transport: "json", successKind: "top_level_object", successFields: ["operation_id", "brand", "market", "platforms", "query_coverage", "sentiment", "share_of_voice", "analysis_status", "best_platforms", "content_gaps", "post_ideas", "summary"], errorField: "error" },
  what_if: { transport: "json", successKind: "top_level_object", successFields: ["summary", "engine_projections", "estimated_cost", "time_to_impact_weeks", "risks", "final_recommendation"], errorField: "error" },
  brand_authority: { transport: "json", successKind: "top_level_object", successFields: ["operation_id", "slug", "public_url", "publication_scope", "published_on_customer_domain", "summary", "markdown", "json_ld", "ping"], errorField: "error" },
  geo_rewrite: { transport: "json", successKind: "top_level_object", successFields: ["rewritten", "score", "authority", "local", "citation", "added_elements", "verify_notes"], errorField: "error" },
  keyword_intelligence: { transport: "json", successKind: "top_level_object", successFields: ["measured_keywords", "measured_pairs", "payload", "summary", "diagnostics", "evidence_state", "evidence_note", "parties", "competitor_validation", "context", "charged", "llms", "missing_fields", "clusters"], errorField: "error" },
};

const INTERNAL_OPTIONS: Partial<Record<ToolKey, ToolOptions>> = {
  translate: { fields: ["target_lang"], contextFields: ["lang", "prior_results"] },
  teach_space: { fields: [], contextFields: ["goal", "prior_results", "workspace_id"] },
};

const INTERNAL_OUTPUTS: Partial<Record<ToolKey, ToolOutputContract>> = {
  translate: { transport: "internal", successKind: "top_level_object", successFields: ["target_lang", "text", "charged"], errorField: "error" },
  teach_space: { transport: "internal", successKind: "top_level_object", successFields: ["saved_facts"], errorField: "error" },
};

export type ToolExecutionContract = {
  key: ToolKey;
  execution: ToolExecutionKind;
  availability: ToolAvailability;
  /** POST API path for sub-tool dispatch. Null for internal/special keys. */
  path: string | null;
  /** Product entry point; not eligible as a sub-tool plan step. */
  entryPath: string | null;
  plannerSelectable: boolean;
  skillExecutable: boolean;
  /** Existing auth boundary; this registry does not bypass or reimplement it. */
  authorizationOwner: ToolAuthorizationOwner;
  /** Billing responsibility remains with the existing route/orchestrator implementation. */
  billingOwner: ToolBillingOwner;
  options: ToolOptions | null;
  output: ToolOutputContract | null;
};

const API_PATHS: Partial<Record<ToolKey, string>> = {
  analyze: "/api/analyze",
  suggest: "/api/suggest",
  compare: "/api/compare",
  known: "/api/known",
  feasibility: "/api/feasibility",
  bizdev: "/api/bizdev",
  research: "/api/research",
  visibility: "/api/visibility",
  brand_boost: "/api/brand-boost",
  company_email: "/api/company-email",
  applied_ranking: "/api/applied-ranking",
  geo_strategist: "/api/geo-strategist",
  competitor_monitor: "/api/competitor-monitor",
  social_analysis: "/api/social-analysis",
  what_if: "/api/what-if",
  brand_authority: "/api/brand-authority",
  geo_rewrite: "/api/geo-rewrite",
  keyword_intelligence: "/api/dual-result",
};

const INTERNAL_TOOLS = new Set<ToolKey>(["translate", "teach_space"]);
const PAUSED_TOOLS = new Set<ToolKey>(["competitor_monitor"]);

export const TOOL_PATH_ALIASES: Record<string, ToolKey> = {
  competitor_compare: "compare",
};

function buildContract(key: ToolKey): ToolExecutionContract {
  const path = API_PATHS[key] || null;
  const execution: ToolExecutionKind = path
    ? "api"
    : INTERNAL_TOOLS.has(key)
      ? "internal"
      : key === "maaroof"
        ? "coordinator"
        : "agent_only";
  const availability: ToolAvailability = PAUSED_TOOLS.has(key)
    ? "paused"
    : execution === "api" || execution === "internal"
      ? "active"
      : "special";
  const plannerSelectable = availability === "active" && (execution === "api" || execution === "internal");
  return {
    key,
    execution,
    availability,
    path,
    entryPath: key === "maaroof" ? "/api/maaroof" : null,
    plannerSelectable,
    skillExecutable: plannerSelectable,
    authorizationOwner: execution === "api" ? "route" : execution === "agent_only" ? "none" : "orchestrator",
    billingOwner: availability === "paused" || execution === "agent_only" || key === "teach_space"
      ? "none"
      : execution === "api" ? "route" : "orchestrator",
    options: TOOL_OPTIONS[key] || INTERNAL_OPTIONS[key] || null,
    output: API_OUTPUTS[key] || INTERNAL_OUTPUTS[key] || null,
  };
}

export const TOOL_CONTRACTS: Record<ToolKey, ToolExecutionContract> = Object.fromEntries(
  TOOL_CATALOG.map((tool) => [tool.key, buildContract(tool.key)]),
) as Record<ToolKey, ToolExecutionContract>;

export function getToolContract(key: string): ToolExecutionContract | null {
  return TOOL_CONTRACTS[key as ToolKey] || null;
}

/** Resolve a sub-tool API path, preserving the legacy competitor_compare alias. */
export function getToolPath(key: string): string | null {
  const canonical = TOOL_PATH_ALIASES[key] || key;
  return getToolContract(canonical)?.path || null;
}

export function getPlannerSelectableToolKeys(): ToolKey[] {
  return Object.values(TOOL_CONTRACTS).filter((contract) => contract.plannerSelectable).map((contract) => contract.key);
}

export function getSkillExecutableToolKeys(): ToolKey[] {
  return Object.values(TOOL_CONTRACTS).filter((contract) => contract.skillExecutable).map((contract) => contract.key);
}

export function getApiToolPaths(): string[] {
  return Object.values(TOOL_CONTRACTS)
    .filter((contract) => contract.execution === "api" && contract.path)
    .map((contract) => contract.path as string);
}
