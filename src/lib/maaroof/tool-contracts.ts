/**
 * Canonical tool execution contracts shared by the skill catalogue and orchestrator.
 * This is an allow-list over existing routes, not a new executor.
 */
export const MAAROOF_TOOL_ROUTES: Readonly<Record<string, string>> = {
  analyze: "/api/analyze",
  suggest: "/api/suggest",
  compare: "/api/compare",
  competitor_compare: "/api/compare",
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
};

/** These tools are implemented inside the existing orchestrator rather than via an API route. */
export const INTERNAL_TOOL_RUNNERS = ["translate", "teach_space"] as const;
export type InternalToolRunner = (typeof INTERNAL_TOOL_RUNNERS)[number];

export const EXECUTABLE_TOOL_KEYS = [
  ...Object.keys(MAAROOF_TOOL_ROUTES),
  ...INTERNAL_TOOL_RUNNERS,
].filter((key, index, all) => all.indexOf(key) === index);

export function getToolRoute(toolKey: string): string | null {
  return MAAROOF_TOOL_ROUTES[toolKey] || null;
}

export function isExecutableTool(toolKey: string): boolean {
  return EXECUTABLE_TOOL_KEYS.includes(toolKey);
}

export function toolContractDiagnostics(input: {
  skills: Array<{ key: string; tools: string[] }>;
  catalogueKeys: string[];
  directRoutePaths: string[];
}): string[] {
  const errors: string[] = [];
  const catalogue = new Set(input.catalogueKeys);
  const routes = new Set(input.directRoutePaths);
  for (const skill of input.skills) {
    if (!skill.tools.length) errors.push("skill_without_tools:" + skill.key);
    for (const tool of skill.tools) {
      if (!catalogue.has(tool)) errors.push("tool_missing_from_catalogue:" + skill.key + ":" + tool);
      if (!isExecutableTool(tool)) errors.push("tool_not_executable:" + skill.key + ":" + tool);
      const route = getToolRoute(tool);
      if (route && !routes.has(route)) errors.push("tool_route_not_direct_dispatchable:" + skill.key + ":" + tool + ":" + route);
      if (!route && !(INTERNAL_TOOL_RUNNERS as readonly string[]).includes(tool)) errors.push("tool_has_no_route_or_internal_runner:" + skill.key + ":" + tool);
    }
  }
  return errors;
}
