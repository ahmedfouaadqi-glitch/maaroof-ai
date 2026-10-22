import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";

/** Old /dashboard ?tool= keys → tool catalog keys. */
export const DASHBOARD_TO_CATALOG: Record<string, string> = {
  analyze: "analyze", suggest: "suggest", compare: "compare", known: "known", feasibility: "feasibility",
  bizdev: "bizdev", boost: "brand_boost", applied: "applied_ranking", social: "social_analysis",
  monitor: "competitor_monitor", strategist: "geo_strategist", whatif: "what_if", report: "report",
};

/** First skill (catalog order) that uses a tool; undefined for standalone tools like the report builder. Pure. */
export function skillForTool(tool: string): string | undefined {
  return MAAROOF_SKILLS.find((s) => s.tools.includes(tool))?.key;
}

/** Maaroof Space search params for an old /dashboard link. Pure. */
export function workspaceSearchForDashboard(dashTool: unknown): { tab: "skills"; skill?: string; tool?: string } {
  const tool = typeof dashTool === "string" ? DASHBOARD_TO_CATALOG[dashTool] : undefined;
  if (!tool) return { tab: "skills" };
  const skill = skillForTool(tool);
  return { tab: "skills", ...(skill ? { skill } : {}), tool };
}
