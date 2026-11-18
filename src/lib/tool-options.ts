// Planner-facing tool metadata. This is intentionally not an exhaustive
// endpoint schema: UI-only controls and injected context are classified separately.

export type ToolOptions = {
  /** UI tabs / modes this tool exposes (for the planner's understanding). */
  tabs?: string[];
  /** Fields the planner may propose as task input. */
  fields: string[];
  /** UI controls / operation flags not normally proposed by the planner. */
  uiFields?: string[];
  /** Values injected from workspace, entity profile, request locale or runtime context. */
  contextFields?: string[];
  /** The endpoint's primary entity-name input, when applicable. */
  brandField?: string;
  /** Required fields checked before the orchestrator dispatches a step. */
  requiredFields?: string[];
  /** At least one valid field in each group must be present. */
  requiredAnyOf?: string[][];
  /** Minimum string lengths for required fields. */
  minLength?: Record<string, number>;
  /** Closed-value fields: any other value is dropped (endpoint default applies). */
  enums?: Record<string, string[]>;
};

export const TOOL_OPTIONS: Record<string, ToolOptions> = {
  analyze: { fields: ["text"], contextFields: ["lang", "scope", "workspace_id"] },
  suggest: { fields: ["description", "sourceText", "brand", "audience", "contentType", "count", "length", "platforms", "goal"], uiFields: ["imageBase64", "imageMime"], contextFields: ["lang", "scope", "workspace_id"], requiredFields: ["description"] },
  compare: { fields: ["brand", "competitors", "keywords", "websites"], contextFields: ["lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"] },
  known: { fields: ["brand", "sector", "keywords", "website", "depth"], uiFields: ["force"], contextFields: ["url", "lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"], enums: { depth: ["quick", "deep"] } },
  feasibility: { fields: ["project_name", "sector", "city", "problem", "solution", "target_audience", "revenue_model", "budget_iqd", "team_size", "timeline_months", "competitors", "notes"], contextFields: ["lang", "scope", "workspace_id"], brandField: "project_name", requiredFields: ["project_name"] },
  bizdev: { fields: ["business_name", "sector", "stage", "city", "goals", "challenges", "channels", "budget_iqd", "current_revenue_iqd", "monthly_customers", "team_size", "notes"], contextFields: ["lang", "scope", "workspace_id"], brandField: "business_name", requiredFields: ["business_name"] },
  research: { fields: ["query", "mode"], uiFields: ["include_channels", "channel_types", "force"], contextFields: ["lang", "scope", "workspace_id"], requiredFields: ["query"], enums: { mode: ["web", "company"] } },
  visibility: { tabs: ["visibility", "share_of_voice", "history", "live_probe"], fields: ["brand", "keywords", "probe_engines", "notify"], uiFields: ["background"], contextFields: ["official_website", "lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"] },
  brand_boost: { tabs: ["visibility", "research", "outreach", "run", "authority", "propagation", "logs"], fields: ["brand_name", "brand_keywords", "platforms"], contextFields: ["website_url", "lang", "scope", "workspace_id"], brandField: "brand_name", requiredFields: ["brand_name"] },
  company_email: { fields: ["company", "sector", "notes", "goal", "mode"], contextFields: ["lang", "scope", "workspace_id"], brandField: "company", requiredFields: ["company"], enums: { mode: ["search", "email", "brand"] } },
  applied_ranking: { fields: ["brand_name", "brand_keywords", "app_name", "app_url", "website", "sector", "notes"], contextFields: ["lang", "scope", "workspace_id", "workspaceId"], brandField: "brand_name", requiredFields: ["brand_name"] },
  geo_strategist: { fields: ["brand", "keywords", "goals", "timeframe"], contextFields: ["lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"] },
  competitor_monitor: { fields: ["action", "id", "brand", "competitors", "frequency_hours"], contextFields: ["lang", "workspace_id"], enums: { action: ["create", "list", "recheck", "delete", "policy"] } },
  social_analysis: { fields: ["brand", "keywords"], contextFields: ["official_website", "lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"] },
  what_if: { fields: ["brand", "changes", "kind", "axes"], contextFields: ["lang", "workspace_id"], brandField: "brand", requiredFields: ["brand"] },
  brand_authority: { fields: ["brand_name", "brand_keywords", "source_url", "ping"], contextFields: ["lang", "workspace_id"], brandField: "brand_name", requiredFields: ["brand_name"] },
  geo_rewrite: { fields: ["text"], contextFields: ["lang", "scope", "workspace_id"], requiredFields: ["text"], minLength: { text: 25 } },
  keyword_intelligence: { fields: ["brand", "site", "category", "competitors", "market_text"], uiFields: ["attachment_id", "content_language", "live_search", "live_search_limit", "estimate_only", "skip_keyword_pairs", "skip_keywords", "cluster_limit", "sample_limit", "markets", "geo_scope", "request_text", "target_market", "text"], contextFields: ["lang", "workspace_id"], brandField: "brand", requiredAnyOf: [["brand", "site"]], enums: { lang: ["ar", "en", "ku"] } },
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
