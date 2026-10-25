/**
 * Source Intelligence Router — one bounded decision layer in front of existing
 * retrieval paths. Pure functions only; this module never performs network I/O.
 */
export const SOURCE_CAPABILITIES = [
  "web_search", "news_search", "url_read", "market_intelligence", "structured_data", "answer_visibility",
] as const;
export type SourceCapability = (typeof SOURCE_CAPABILITIES)[number];
export const REALITY_KINDS = ["observation", "measurement", "estimate", "inference", "unverified"] as const;
export type RealityKind = (typeof REALITY_KINDS)[number];
export const SOURCE_STATUSES = ["success", "empty", "unavailable", "blocked", "stale", "failed"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export type SourceBudget = {
  maxRequests: number;
  maxEstimatedCredits: number;
  usedRequests?: number;
  usedEstimatedCredits?: number;
};
export type SourceRouteInput = {
  goal: string;
  capability?: SourceCapability;
  language?: string;
  market?: string | null;
  available?: { webSearch?: boolean; directRead?: boolean; alexandria?: boolean };
  requestSpecializedDiscovery?: boolean;
  budget?: SourceBudget;
  cacheHit?: boolean;
};
export type SourceRoutePlan = {
  capability: SourceCapability;
  language: string;
  market: string | null;
  primary: "web" | "news" | "url_read" | "alexandria_catalogue" | "none";
  searchSources: Array<"web" | "news">;
  maxRequests: number;
  maxEstimatedCredits: number;
  requestsAvailable: number;
  creditsAvailable: number;
  useCache: boolean;
  discoverSpecializedSources: boolean;
  executeSpecializedSource: false;
  reason: string;
  limitations: string[];
};

const clampInt = (v: unknown, fallback: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : fallback;
};
const NEWS_RE = /\b(news|latest|recent|today|yesterday|this week|breaking|press release|أخبار|آخر|احدث|أحدث|اليوم|هذا الأسبوع|صحافة|خبر|هەواڵ|ئەمڕۆ|دوێنێ)\b/i;
const MARKET_RE = /\b(market size|industry trend|market trends|pricing|prices|share of voice|سوق|السوق|اتجاهات|حجم السوق|الأسعار|نرخ|بازاڕ|ڕەوت)\b/i;
const URL_RE = /https?:\/\/[^\s]+/i;

export function inferSourceCapability(goal: string): SourceCapability {
  const text = String(goal || "");
  if (URL_RE.test(text) && /\b(read|scrape|صفحة|رابط|اقرأ|افحص|crawl|website audit)\b/i.test(text)) return "url_read";
  if (/\b(visibility|mention rate|citation rate|answer engine|ai answers|ظهور|ذكر العلامة|استشهاد|إجابات الذكاء الاصطناعي)\b/i.test(text)) return "answer_visibility";
  if (MARKET_RE.test(text)) return "market_intelligence";
  if (NEWS_RE.test(text)) return "news_search";
  return "web_search";
}

export function planSourceRoute(input: SourceRouteInput): SourceRoutePlan {
  const goal = String(input.goal || "").trim().slice(0, 1000);
  const capability = input.capability || inferSourceCapability(goal);
  const available = { webSearch: true, directRead: true, alexandria: false, ...(input.available || {}) };
  const budget = input.budget || { maxRequests: 1, maxEstimatedCredits: 0 };
  const maxRequests = clampInt(budget.maxRequests, 1, 20);
  const maxEstimatedCredits = Math.max(0, Number.isFinite(Number(budget.maxEstimatedCredits)) ? Number(budget.maxEstimatedCredits) : 0);
  const usedRequests = clampInt(budget.usedRequests, 0, 1_000_000);
  const usedCredits = Math.max(0, Number(budget.usedEstimatedCredits) || 0);
  const requestsAvailable = Math.max(0, maxRequests - usedRequests);
  const creditsAvailable = Math.max(0, maxEstimatedCredits - usedCredits);
  const useCache = input.cacheHit === true;
  const isUrl = URL_RE.test(goal);
  const wantsNews = capability === "news_search" || NEWS_RE.test(goal);
  const requestsAvailableForWork = useCache ? 0 : requestsAvailable;
  let primary: SourceRoutePlan["primary"] = "none";
  let searchSources: SourceRoutePlan["searchSources"] = [];
  let discoverSpecializedSources = false;
  const limitations: string[] = [];

  if (useCache) primary = "none";
  else if (capability === "url_read" || (isUrl && capability !== "answer_visibility")) {
    if (available.directRead) primary = "url_read";
    else limitations.push("direct_read_unavailable");
  } else if (available.webSearch && requestsAvailableForWork > 0 && creditsAvailable >= 2) {
    // A bounded query requires at least the minimum documented search allowance; actual returned-result cost is recorded by the existing usage ledger.
    searchSources = wantsNews ? ["web", "news"] : ["web"];
    primary = wantsNews ? "news" : "web";
  } else if (requestsAvailableForWork <= 0) limitations.push("request_budget_exhausted");
  else if (available.webSearch && creditsAvailable < 2) limitations.push("credit_budget_below_minimum_search_cost");
  else limitations.push("no_eligible_search_source");

  if (input.requestSpecializedDiscovery && available.alexandria && !useCache && requestsAvailableForWork > 0) {
    discoverSpecializedSources = true;
    if (primary === "none") primary = "alexandria_catalogue";
  }
  if (capability === "market_intelligence" && !discoverSpecializedSources) limitations.push("specialized_market_sources_not_enabled");
  if (capability === "answer_visibility") limitations.push("web_signals_are_not_direct_ai_answer_measurements");

  const reason = useCache ? "fresh_cache_reuse" :
    discoverSpecializedSources ? "explicit_specialized_discovery_only" :
    primary === "news" ? "recent_information_requested" :
    primary === "web" ? "general_web_evidence_sufficient_for_first_pass" :
    primary === "url_read" ? "specific_public_url_requested" :
    "no_source_selected_within_current_constraints";

  return {
    capability,
    language: String(input.language || "en").slice(0, 12),
    market: input.market ? String(input.market).slice(0, 120) : null,
    primary, searchSources, maxRequests, maxEstimatedCredits, requestsAvailable, creditsAvailable,
    useCache, discoverSpecializedSources, executeSpecializedSource: false, reason,
    limitations: Array.from(new Set(limitations)),
  };
}

export type SourceEvidence = {
  provider: string;
  capability: string;
  sourceRef: string | null;
  retrievedAt: string;
  dataPeriod?: string | null;
  locale?: string | null;
  market?: string | null;
  measurementUnit?: string | null;
  sampleSize?: number | null;
  realityKind: RealityKind;
  status: SourceStatus;
  limitation?: string | null;
  title?: string | null;
  claim?: string | null;
  sourceReliability?: number;
  relevanceScore?: number;
  businessImportance?: number;
};

/** Normalize source facts without claiming more than the returned data supports. */
export function normalizeSourceEvidence(input: Partial<SourceEvidence> & { provider: string; capability: string }): SourceEvidence {
  const allowedReality = new Set<string>(REALITY_KINDS);
  const allowedStatus = new Set<string>(SOURCE_STATUSES);
  const sample = input.sampleSize == null ? null : Number(input.sampleSize);
  return {
    provider: String(input.provider || "unknown").slice(0, 100),
    capability: String(input.capability || "unknown").slice(0, 120),
    sourceRef: input.sourceRef ? String(input.sourceRef).slice(0, 2048) : null,
    retrievedAt: input.retrievedAt && Number.isFinite(Date.parse(input.retrievedAt)) ? new Date(input.retrievedAt).toISOString() : new Date().toISOString(),
    dataPeriod: input.dataPeriod ? String(input.dataPeriod).slice(0, 120) : null,
    locale: input.locale ? String(input.locale).slice(0, 20) : null,
    market: input.market ? String(input.market).slice(0, 120) : null,
    measurementUnit: input.measurementUnit ? String(input.measurementUnit).slice(0, 80) : null,
    sampleSize: sample != null && Number.isFinite(sample) ? Math.max(0, Math.floor(sample)) : null,
    realityKind: allowedReality.has(String(input.realityKind)) ? input.realityKind as RealityKind : "unverified",
    status: allowedStatus.has(String(input.status)) ? input.status as SourceStatus : "success",
    limitation: input.limitation ? String(input.limitation).slice(0, 1000) : null,
    title: input.title ? String(input.title).slice(0, 300) : null,
    claim: input.claim ? String(input.claim).slice(0, 2000) : null,
    sourceReliability: clampScore(input.sourceReliability, 50),
    relevanceScore: clampScore(input.relevanceScore, 50),
    businessImportance: clampScore(input.businessImportance, 50),
  };
}
function clampScore(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

export type VisibilityObservation = {
  status: "success" | "failed" | "unavailable";
  mentioned?: boolean | null;
  cited?: boolean | null;
  position?: number | null;
};
export type VisibilityMetrics = {
  attempted: number; successful: number; failed: number; coverageRate: number | null;
  mentionSamples: number; mentions: number; mentionRate: number | null;
  citationSamples: number; citations: number; citationRate: number | null;
  averagePosition: number | null; limitation: string | null;
};

/** Failed probes are excluded from metric denominators; mention and citation rates remain separate. */
export function aggregateVisibilityMetrics(rows: VisibilityObservation[]): VisibilityMetrics {
  const input = Array.isArray(rows) ? rows : [];
  const valid = input.filter((r) => r.status === "success");
  const failed = input.length - valid.length;
  const mentionRows = valid.filter((r) => typeof r.mentioned === "boolean");
  const citationRows = valid.filter((r) => typeof r.cited === "boolean");
  const positions = valid.map((r) => Number(r.position)).filter((n) => Number.isFinite(n) && n > 0);
  const rate = (n: number, total: number) => total ? Math.round((n / total) * 10000) / 100 : null;
  return {
    attempted: input.length, successful: valid.length, failed,
    coverageRate: input.length ? rate(valid.length, input.length) : null,
    mentionSamples: mentionRows.length, mentions: mentionRows.filter((r) => r.mentioned).length,
    mentionRate: rate(mentionRows.filter((r) => r.mentioned).length, mentionRows.length),
    citationSamples: citationRows.length, citations: citationRows.filter((r) => r.cited).length,
    citationRate: rate(citationRows.filter((r) => r.cited).length, citationRows.length),
    averagePosition: positions.length ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 100) / 100 : null,
    limitation: failed ? String(failed) + " of " + String(input.length) + " probes failed or were unavailable and were excluded from mention/citation denominators." : null,
  };
}

/** Estimate the documented query-result and optional page-read credits. Discovery-only catalogue searches are free. */
export function estimateSearchCredits(input: {
  resultCount: number;
  sources?: string[];
  includePageContent?: boolean;
}): { queryCredits: number; pageCredits: number; estimatedCredits: number; billable: boolean } {
  const count = Math.max(0, Math.min(10000, Math.floor(Number(input.resultCount) || 0)));
  const sources = Array.isArray(input.sources) && input.sources.length ? input.sources : ["web"];
  const catalogueOnly = sources.length === 1 && sources[0] === "alexandria";
  if (catalogueOnly || count === 0) {
    return { queryCredits: 0, pageCredits: 0, estimatedCredits: 0, billable: false };
  }
  const queryCredits = 2 * Math.ceil(count / 10);
  const pageCredits = input.includePageContent ? count : 0;
  return { queryCredits, pageCredits, estimatedCredits: queryCredits + pageCredits, billable: queryCredits + pageCredits > 0 };
}

export function measurementSignature(input: { prompts: string[]; language: string; market: string; engines: string[]; methodVersion: string }): string {
  const canon = (values: string[]) => values.map((v) => String(v).trim().replace(/\s+/g, " ").toLowerCase()).sort();
  return JSON.stringify({
    prompts: canon(input.prompts),
    language: input.language.trim().toLowerCase(),
    market: input.market.trim().toLowerCase(),
    engines: canon(input.engines),
    methodVersion: input.methodVersion.trim(),
  });
}

export function canExecuteSpecializedSource(input: {
  discoveredCostCredits: number | null | undefined; maxCredits: number; userConfirmedPaidRun: boolean;
  adminTermsAccepted: boolean; requestId: string;
}): { allowed: boolean; reason: string | null } {
  if (!input.userConfirmedPaidRun) return { allowed: false, reason: "explicit_user_approval_required" };
  if (!input.adminTermsAccepted) return { allowed: false, reason: "organization_terms_not_confirmed" };
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(input.requestId)) return { allowed: false, reason: "idempotency_key_required" };
  const cost = Number(input.discoveredCostCredits);
  if (!Number.isFinite(cost) || cost < 0) return { allowed: false, reason: "unknown_cost_fails_closed" };
  const cap = Number(input.maxCredits);
  if (!Number.isFinite(cap) || cap < 0 || cost > cap) return { allowed: false, reason: "cost_cap_exceeded" };
  return { allowed: true, reason: null };
}
