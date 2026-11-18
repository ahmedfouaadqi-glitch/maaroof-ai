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
  options: ToolOptions | null;
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
const AGENT_ONLY_TOOLS = new Set<ToolKey>(["agent.command", "agent.run_targets", "agent.visibility"]);
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
    options: TOOL_OPTIONS[key] || null,
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
