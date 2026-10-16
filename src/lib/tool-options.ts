// Data-only map of what each tool endpoint actually accepts (read from the
// request body of every /api/* route). Lets the Maaroof planner pick correct
// tabs/options and lets the executor drop invalid enum values. No logic.

export type ToolOptions = {
  /** UI tabs / modes this tool exposes (for the planner's understanding). */
  tabs?: string[];
  /** Body fields the endpoint reads. */
  fields: string[];
  /** Closed-value fields: any other value is dropped (endpoint default applies). */
  enums?: Record<string, string[]>;
};

export const TOOL_OPTIONS: Record<string, ToolOptions> = {
  analyze: { fields: ["text"] },
  suggest: { fields: ["description", "sourceText", "brand", "audience", "contentType", "count", "length", "platforms", "goal"] },
  compare: { fields: ["brand", "competitors", "keywords", "websites"] },
  competitor_compare: { fields: ["brand", "competitors", "keywords", "websites"] },
  known: { fields: ["brand", "sector", "website", "depth", "force"], enums: { depth: ["quick", "deep"] } },
  feasibility: { fields: ["project_name", "sector", "city", "problem", "solution", "target_audience", "revenue_model", "budget_iqd", "team_size", "timeline_months", "competitors", "notes"] },
  bizdev: { fields: ["business_name", "sector", "stage", "city", "goals", "challenges", "channels", "budget_iqd", "current_revenue_iqd", "monthly_customers", "team_size", "notes"] },
  research: { fields: ["query", "mode"], enums: { mode: ["web", "company"] } },
  visibility: { tabs: ["visibility", "share_of_voice", "history", "live_probe"], fields: ["brand", "keywords", "probe_engines", "background", "notify"] },
  brand_boost: { tabs: ["visibility", "research", "outreach", "run", "authority", "propagation", "logs"], fields: ["brand_name", "brand_keywords", "platforms"] },
  company_email: { fields: ["company", "sector", "notes", "goal", "mode"], enums: { mode: ["search", "email", "brand"] } },
  applied_ranking: { fields: ["brand_name", "brand_keywords", "app_name", "app_url", "website", "sector", "notes"] },
  geo_strategist: { fields: ["brand", "keywords", "goals"] },
  competitor_monitor: { fields: ["action", "id", "brand", "competitors", "frequency_hours"], enums: { action: ["create", "list", "recheck", "delete", "policy"] } },
  social_analysis: { fields: ["brand", "keywords"] },
  what_if: { fields: ["brand", "changes", "kind", "axes"] },
  brand_authority: { fields: ["brand_name", "brand_keywords", "source_url", "ping"] },
  geo_rewrite: { fields: ["text"] },
};

/** One planner-readable line describing a tool's accepted options. */
export function describeToolOptions(tool: string): string {
  const o = TOOL_OPTIONS[tool];
  if (!o) return "";
  const parts = [`fields: ${o.fields.join(", ")}`];
  if (o.tabs?.length) parts.push(`tabs: ${o.tabs.join(", ")}`);
  if (o.enums) for (const [k, v] of Object.entries(o.enums)) parts.push(`${k} ∈ {${v.join("|")}}`);
  return parts.join("; ");
}

/** Drop closed-value fields whose value isn't allowed (endpoint default applies). */
export function enforceEnums(tool: string, input: Record<string, any>): Record<string, any> {
  const en = TOOL_OPTIONS[tool]?.enums;
  if (!en) return input;
  const out = { ...input };
  for (const [k, allowed] of Object.entries(en)) {
    if (k in out && !allowed.includes(String(out[k]))) delete out[k];
  }
  return out;
}
