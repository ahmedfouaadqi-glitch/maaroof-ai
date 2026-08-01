// Central catalog of all tools and agent features that can be linked to plans.
// Edit here to add a new tool — admin UI and gates pick it up automatically.
//
// Evolved (Executive AI OS constitution, Part 1):
//   Each tool now also acts as an **Expert Cognitive Engine** with:
//   - capabilities, strengths, weaknesses
//   - preferred models / cost profile
//   - short DNA blurb used by the Expert Council prompt
//   We deliberately keep this as a static registry (no new DB table) —
//   see docs/MAAROOF-AUDIT.md § "Constitution Compliance Matrix".

export type ToolKey =
  | "analyze"
  | "suggest"
  | "compare"
  | "feasibility"
  | "bizdev"
  | "research"
  | "visibility"
  | "brand_boost"
  | "company_email"
  | "applied_ranking"
  | "geo_strategist"
  | "competitor_monitor"
  | "social_analysis"
  | "what_if"
  | "brand_authority"
  | "geo_rewrite"
  | "maaroof"
  | "agent.command"
  | "agent.run_targets"
  | "agent.visibility"
  | "teach_space";

/**
 * Capability taxonomy — how Maaroof searches for experts.
 * Maaroof looks up a *capability*, not a tool name. Multiple experts can
 * share a capability; the orchestrator picks the best-fit expert.
 */
export type Capability =
  | "geo_analysis"
  | "seo"
  | "aeo"
  | "visibility"
  | "competitor_analysis"
  | "market_intelligence"
  | "research"
  | "writing"
  | "content_generation"
  | "brand_strategy"
  | "brand_authority"
  | "ranking"
  | "email_outreach"
  | "business_development"
  | "forecasting"
  | "scenario_simulation"
  | "monitoring"
  | "planning"
  | "knowledge_extraction"
  | "social_analysis"
  // ---- Part 4 additions (Capability OS) ----
  | "decision_making"
  | "summarization"
  | "validation"
  | "reflection"
  | "translation"
  | "localization"
  | "memory_retrieval"
  | "memory_learning"
  | "knowledge_refresh"
  | "knowledge_graph"
  | "automation"
  | "scheduling"
  | "reasoning"
  | "image_analysis"
  | "document_analysis"
  | "video_analysis";

export type CostProfile = "light" | "medium" | "heavy";
export type RiskLevel = "low" | "medium" | "high";

export type ToolDef = {
  key: ToolKey;
  group: "tools" | "agent";
  labels: { ar: string; en: string; ku: string };
  costPerRun: number; // analyses/tasks consumed per execution
  // ---- Expert DNA (constitution v1) ----
  capabilities?: Capability[];
  strengths?: string[];
  weaknesses?: string[];
  preferredModels?: string[];
  costProfile?: CostProfile;
  /** One-line expert persona used by the council prompt. */
  dna?: string;
  // ---- Part 4 optional metadata (all additive) ----
  avgQuality?: number;         // 0-100 baseline quality
  avgLatencyMs?: number;       // typical latency
  riskLevel?: RiskLevel;
  requiredPolicies?: string[];
  requiredKnowledge?: string[];
};

export const TOOL_CATALOG: ToolDef[] = [
  {
    key: "analyze", group: "tools", costPerRun: 1,
    labels: { ar: "تحليل GEO", en: "GEO Analysis", ku: "شیکاری GEO" },
    capabilities: ["geo_analysis", "visibility", "knowledge_extraction"],
    strengths: ["deep page audit", "GEO scoring", "actionable fixes"],
    weaknesses: ["single-URL scope", "no market comparison"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "light",
    dna: "GEO auditor: reads a page and scores its readiness for generative engines.",
  },
  {
    key: "suggest", group: "tools", costPerRun: 1,
    labels: { ar: "مولّد المنشورات", en: "Post Generator", ku: "دروستکەری پۆست" },
    capabilities: ["writing", "content_generation"],
    strengths: ["fast localized copy", "channel-aware tone"],
    weaknesses: ["no research grounding", "shallow facts"],
    preferredModels: ["google/gemini-2.5-flash"],
    costProfile: "light",
    dna: "Copy expert: turns a brief into localized posts.",
  },
  {
    key: "compare", group: "tools", costPerRun: 1,
    labels: { ar: "مقارنة المنافسين", en: "Competitor Compare", ku: "بەراوردکردنی ڕکابەران" },
    capabilities: ["competitor_analysis", "market_intelligence"],
    strengths: ["side-by-side gap map", "actionable delta"],
    weaknesses: ["needs URLs upfront"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "medium",
    dna: "Rival strategist: reveals gaps vs named competitors.",
  },
  {
    key: "feasibility", group: "tools", costPerRun: 2,
    labels: { ar: "دراسة جدوى", en: "Feasibility Study", ku: "لێکۆڵینەوەی شیاو" },
    capabilities: ["forecasting", "market_intelligence", "planning"],
    strengths: ["financial framing", "risk map"],
    weaknesses: ["assumes credible inputs"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "heavy",
    dna: "Business analyst: turns an idea into a feasibility model.",
  },
  {
    key: "bizdev", group: "tools", costPerRun: 2,
    labels: { ar: "تطوير الأعمال", en: "BizDev", ku: "گەشەپێدانی کار" },
    capabilities: ["business_development", "planning", "market_intelligence"],
    strengths: ["growth channels", "partnership angles"],
    weaknesses: ["depends on target definition"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "medium",
    dna: "Growth strategist: proposes channels, partners, and moves.",
  },
  {
    key: "research", group: "tools", costPerRun: 2,
    labels: { ar: "بحث ذكي", en: "Smart Research", ku: "گەڕانی زیرەک" },
    capabilities: ["research", "knowledge_extraction", "market_intelligence"],
    strengths: ["multi-source synthesis", "citations"],
    weaknesses: ["slower than single-shot LLM"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "heavy",
    dna: "Researcher: gathers and cross-checks evidence before answering.",
  },
  {
    key: "visibility", group: "tools", costPerRun: 1,
    labels: { ar: "تحليل الظهور", en: "AI Visibility", ku: "پشکنینی دیارییەتی" },
    capabilities: ["visibility", "aeo", "monitoring"],
    strengths: ["engine coverage matrix"],
    weaknesses: ["snapshot only"],
    preferredModels: ["google/gemini-2.5-flash"],
    costProfile: "light",
    dna: "Visibility scout: reports how a brand appears across AI engines.",
  },
  {
    key: "brand_boost", group: "tools", costPerRun: 5,
    labels: { ar: "تعزيز العلامة", en: "Brand Boost", ku: "بەهێزکردنی براند" },
    capabilities: ["brand_strategy", "content_generation", "planning"],
    strengths: ["multi-asset campaign", "consistent voice"],
    weaknesses: ["expensive"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "heavy",
    dna: "Campaign director: produces a coordinated brand push.",
  },
  {
    key: "company_email", group: "tools", costPerRun: 1,
    labels: { ar: "إيميل شركات", en: "Company Outreach", ku: "ئیمەیڵی کۆمپانیا" },
    capabilities: ["email_outreach", "writing"],
    strengths: ["B2B tone", "personalization hooks"],
    weaknesses: ["no delivery, drafting only"],
    preferredModels: ["google/gemini-2.5-flash"],
    costProfile: "light",
    dna: "Outreach writer: crafts targeted business emails.",
  },
  {
    key: "applied_ranking", group: "tools", costPerRun: 2,
    labels: { ar: "الترتيب التطبيقي", en: "Applied Ranking", ku: "ڕیزبەندی جێبەجێکراو" },
    capabilities: ["ranking", "seo", "geo_analysis"],
    strengths: ["prioritized fix list"],
    weaknesses: ["needs baseline data"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "medium",
    dna: "Ranking coach: turns audit findings into an ordered action plan.",
  },
  {
    key: "geo_strategist", group: "tools", costPerRun: 2,
    labels: { ar: "إستراتيجي GEO", en: "GEO Strategist", ku: "ستراتیژی GEO" },
    capabilities: ["planning", "geo_analysis", "brand_strategy"],
    strengths: ["long-horizon roadmap"],
    weaknesses: ["heavier prompt cost"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "medium",
    dna: "GEO strategist: designs a 30/60/90-day generative-visibility plan.",
  },
  {
    key: "competitor_monitor", group: "tools", costPerRun: 1,
    labels: { ar: "مراقبة المنافسين", en: "Competitor Monitor", ku: "چاودێری ڕکابەران" },
    capabilities: ["monitoring", "competitor_analysis"],
    strengths: ["change detection", "alerting"],
    weaknesses: ["needs watchlist"],
    preferredModels: ["google/gemini-2.5-flash"],
    costProfile: "light",
    dna: "Watchdog: tracks competitor changes over time.",
  },
  {
    key: "social_analysis", group: "tools", costPerRun: 1,
    labels: { ar: "تحليل الظهور الاجتماعي", en: "Social Visibility", ku: "شیکاری سۆشیال" },
    capabilities: ["social_analysis", "visibility"],
    strengths: ["cross-platform overview"],
    weaknesses: ["public data only"],
    preferredModels: ["google/gemini-2.5-flash"],
    costProfile: "light",
    dna: "Social analyst: reads a brand's social footprint.",
  },
  {
    key: "what_if", group: "tools", costPerRun: 2,
    labels: { ar: "محاكاة What-If", en: "What-If Simulator", ku: "سیمولاتۆری What-If" },
    capabilities: ["scenario_simulation", "forecasting"],
    strengths: ["scenario branching", "sensitivity"],
    weaknesses: ["assumption-heavy"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "medium",
    dna: "Simulator: explores branching business scenarios.",
  },
  {
    key: "brand_authority", group: "tools", costPerRun: 3,
    labels: { ar: "حزمة سلطة العلامة", en: "Brand Authority", ku: "دەسەڵاتی براند" },
    capabilities: ["brand_authority", "brand_strategy", "seo"],
    strengths: ["authority signals bundle"],
    weaknesses: ["long-form only"],
    preferredModels: ["google/gemini-2.5-pro"],
    costProfile: "heavy",
    dna: "Authority builder: crafts signals that earn trust with engines.",
  },
  {
    key: "geo_rewrite", group: "tools", costPerRun: 1,
    labels: { ar: "إعادة كتابة GEO", en: "GEO Rewrite", ku: "نووسینەوەی GEO" },
    capabilities: ["writing", "geo_analysis", "content_generation"],
    strengths: ["quick GEO-friendly rewrite"],
    weaknesses: ["needs source text"],
    preferredModels: ["google/gemini-2.5-flash"],
    costProfile: "light",
    dna: "Rewriter: reshapes existing copy for generative engines.",
  },
  { key: "agent.command",      group: "agent", costPerRun: 1, labels: { ar: "أمر مباشر للوكيل",        en: "Agent Command",       ku: "فەرمانی ئاراستە" } },
  { key: "agent.run_targets",  group: "agent", costPerRun: 2, labels: { ar: "تشغيل الأهداف تلقائياً",   en: "Run Targets",         ku: "جێبەجێکردنی ئامانجەکان" } },
  { key: "agent.visibility",   group: "agent", costPerRun: 1, labels: { ar: "فحص الظهور في AI",       en: "AI Visibility",       ku: "پشکنینی دەرکەوتن" } },
];

export const toolLabel = (key: ToolKey | string, lang: "ar" | "en" | "ku" = "ar") =>
  TOOL_CATALOG.find((t) => t.key === key)?.labels[lang] ?? String(key);

// -----------------------------------------------------------------------------
// Capability Registry API (Executive AI OS)
// -----------------------------------------------------------------------------

/** All tools declaring the given capability. */
export function findExpertsByCapability(cap: Capability): ToolDef[] {
  return TOOL_CATALOG.filter((t) => t.capabilities?.includes(cap));
}

/** Best-fit expert for a capability: prefers heavier profile for planning-type
 * capabilities and lighter for content-type. Returns the first match otherwise. */
export function pickExpertForCapability(cap: Capability): ToolDef | null {
  const cands = findExpertsByCapability(cap);
  if (!cands.length) return null;
  const rank: Record<CostProfile, number> = { heavy: 3, medium: 2, light: 1 };
  return [...cands].sort((a, b) => (rank[b.costProfile || "light"] - rank[a.costProfile || "light"]))[0];
}

/** Distinct capabilities declared across the catalog. */
export function listCapabilities(): Capability[] {
  const s = new Set<Capability>();
  for (const t of TOOL_CATALOG) for (const c of t.capabilities || []) s.add(c);
  return Array.from(s).sort();
}
