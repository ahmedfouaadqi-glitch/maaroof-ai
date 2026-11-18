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
  /** Known endpoint input types. Unlisted fields remain pass-through for compatibility. */
  fieldTypes?: Record<string, "string" | "string[]" | "string|number" | "number" | "boolean" | "object">;
  /** Closed-value fields: any other value is dropped (endpoint default applies). */
  enums?: Record<string, string[]>;
};

export const TOOL_OPTIONS: Record<string, ToolOptions> = {
  analyze: { fields: ["text"], contextFields: ["lang", "scope", "workspace_id"], requiredFields: ["text"], minLength: { text: 20 }, fieldTypes: { text: "string" } },
  suggest: { fields: ["description", "sourceText", "brand", "audience", "contentType", "count", "length", "platforms", "goal"], uiFields: ["imageBase64", "imageMime"], contextFields: ["lang", "scope", "workspace_id"], requiredAnyOf: [["description", "sourceText", "imageBase64"]], fieldTypes: { description: "string", sourceText: "string", audience: "string", contentType: "string", count: "number", length: "string", platforms: "string[]", goal: "string", imageBase64: "string", imageMime: "string" } },
  compare: { fields: ["brand", "competitors", "keywords", "websites"], contextFields: ["lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"], fieldTypes: { brand: "string", competitors: "string[]", keywords: "string", websites: "object" } },
  known: { fields: ["brand", "sector", "keywords", "website", "depth"], uiFields: ["force"], contextFields: ["url", "lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"], enums: { depth: ["quick", "deep"] }, fieldTypes: { brand: "string", sector: "string", keywords: "string", website: "string", force: "boolean" } },
  feasibility: { fields: ["project_name", "sector", "city", "problem", "solution", "target_audience", "revenue_model", "budget_iqd", "team_size", "timeline_months", "competitors", "notes"], contextFields: ["lang", "scope", "workspace_id"], brandField: "project_name", requiredFields: ["project_name"], fieldTypes: { project_name: "string", sector: "string", city: "string", problem: "string", solution: "string", target_audience: "string", revenue_model: "string", budget_iqd: "string|number", team_size: "string|number", timeline_months: "string|number", competitors: "string", notes: "string" } },
  bizdev: { fields: ["business_name", "sector", "stage", "city", "goals", "challenges", "channels", "budget_iqd", "current_revenue_iqd", "monthly_customers", "team_size", "notes"], contextFields: ["lang", "scope", "workspace_id"], brandField: "business_name", requiredFields: ["business_name"], fieldTypes: { business_name: "string", sector: "string", stage: "string", city: "string", goals: "string", challenges: "string", channels: "string", budget_iqd: "string|number", current_revenue_iqd: "string|number", monthly_customers: "string|number", team_size: "string|number", notes: "string" } },
  research: { fields: ["query", "mode"], uiFields: ["include_channels", "channel_types", "force"], contextFields: ["lang", "scope", "workspace_id"], requiredFields: ["query"], enums: { mode: ["web", "company"] }, fieldTypes: { query: "string", mode: "string", include_channels: "boolean", channel_types: "string[]", force: "boolean" } },
  visibility: { tabs: ["visibility", "share_of_voice", "history", "live_probe"], fields: ["brand", "keywords", "probe_engines", "notify"], uiFields: ["background"], contextFields: ["official_website", "lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"], fieldTypes: { brand: "string", keywords: "string", official_website: "string", probe_engines: "string[]", notify: "boolean", background: "boolean" } },
  brand_boost: { tabs: ["visibility", "research", "outreach", "run", "authority", "propagation", "logs"], fields: ["brand_name", "brand_keywords", "platforms"], contextFields: ["website_url", "lang", "scope", "workspace_id"], brandField: "brand_name", requiredFields: ["brand_name"], fieldTypes: { brand_name: "string", brand_keywords: "string", website_url: "string", platforms: "string[]" } },
  company_email: { fields: ["company", "sector", "notes", "goal", "mode"], contextFields: ["lang", "scope", "workspace_id"], brandField: "company", requiredFields: ["company"], enums: { mode: ["search", "email", "brand"] }, fieldTypes: { company: "string", sector: "string", notes: "string", goal: "string", mode: "string" } },
  applied_ranking: { fields: ["brand_name", "brand_keywords", "app_name", "app_url", "website", "sector", "notes"], contextFields: ["lang", "scope", "workspace_id", "workspaceId"], brandField: "brand_name", requiredFields: ["brand_name"], fieldTypes: { brand_name: "string", brand_keywords: "string", app_name: "string", app_url: "string", website: "string", sector: "string", notes: "string" } },
  geo_strategist: { fields: ["brand", "keywords", "goals", "timeframe"], contextFields: ["lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"], fieldTypes: { brand: "string", keywords: "string", goals: "object", timeframe: "string" } },
  competitor_monitor: { fields: ["action", "id", "brand", "competitors", "frequency_hours"], contextFields: ["lang", "workspace_id"], enums: { action: ["create", "list", "recheck", "delete", "policy"] }, fieldTypes: { action: "string", id: "string", brand: "string", competitors: "string[]", frequency_hours: "number" } },
  social_analysis: { fields: ["brand", "keywords"], contextFields: ["official_website", "lang", "scope", "workspace_id"], brandField: "brand", requiredFields: ["brand"], fieldTypes: { brand: "string", keywords: "string", official_website: "string" } },
  what_if: { fields: ["brand", "changes", "kind", "axes"], contextFields: ["lang", "workspace_id"], brandField: "brand", requiredFields: ["brand"], fieldTypes: { brand: "string", changes: "object", kind: "string", axes: "object" } },
  brand_authority: { fields: ["brand_name", "brand_keywords", "source_url", "ping"], contextFields: ["lang", "workspace_id"], brandField: "brand_name", requiredFields: ["brand_name"], fieldTypes: { brand_name: "string", brand_keywords: "string", source_url: "string", ping: "boolean" } },
  geo_rewrite: { fields: ["text"], contextFields: ["lang", "scope", "workspace_id"], requiredFields: ["text"], minLength: { text: 25 }, fieldTypes: { text: "string" } },
  keyword_intelligence: { fields: ["brand", "site", "category", "competitors", "market_text"], uiFields: ["attachment_id", "content_language", "live_search", "live_search_limit", "estimate_only", "skip_keyword_pairs", "skip_keywords", "cluster_limit", "sample_limit", "markets", "geo_scope", "request_text", "target_market", "text"], contextFields: ["lang", "workspace_id"], brandField: "brand", requiredAnyOf: [["brand", "site"]], enums: { lang: ["ar", "en", "ku"] }, fieldTypes: { brand: "string", site: "string", category: "string", competitors: "string[]", market_text: "string", attachment_id: "string", content_language: "string", live_search: "boolean", live_search_limit: "number", estimate_only: "boolean", skip_keyword_pairs: "string[]", skip_keywords: "string[]", cluster_limit: "number", sample_limit: "number", markets: "string[]", geo_scope: "object", request_text: "string", target_market: "string", text: "string" } },
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
