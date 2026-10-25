// Server-only helpers that push every tool toward "rare, unique, authentic" output.
// - buildEvidencePack: real sources via Firecrawl search.
// - assertEvidence: fail loudly when there is no real-world grounding.
// - qualityShell: appends a strict citation contract to any system prompt.
import { fcSearch, type FcCtx } from "./firecrawl";
import { estimateSearchCredits, planSourceRoute, type SourceCapability } from "./maaroof/source-intelligence";

export type EvidenceSource = {
  index: number;
  url: string;
  title: string;
  snippet: string;
  domain: string;
  fetched_at: string;
};

export type EvidencePack = {
  sources: EvidenceSource[];
  query: string;
  context_block: string; // ready to inject into a user prompt
  source_plan?: {
    capability: SourceCapability;
    route: string;
    requested_sources: string[];
    request_count: number;
    estimated_credits: number;
    sample_size: number;
    budget_limited: boolean;
    limitations: string[];
    retrieved_at: string;
  };
};

function domainOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export async function buildEvidencePack(
  query: string,
  opts: {
    limit?: number;
    lang?: string;
    ctx?: FcCtx;
    userId?: string | null;
    toolKey?: string;
    capability?: SourceCapability;
    market?: string | null;
    maxEstimatedCredits?: number;
  } = {},
): Promise<EvidencePack> {
  const limit = Math.max(1, Math.min(opts.limit ?? 4, 6));
  const retrievedAt = new Date().toISOString();
  const capability = opts.capability;
  const maxEstimatedCredits = Number.isFinite(Number(opts.maxEstimatedCredits))
    ? Math.max(0, Number(opts.maxEstimatedCredits))
    : 2 + limit;
  const routePlan = planSourceRoute({
    goal: query.slice(0, 280),
    capability,
    language: opts.lang || "en",
    market: opts.market ?? null,
    available: { webSearch: true, directRead: true, alexandria: false },
    budget: { maxRequests: 1, maxEstimatedCredits },
  });
  let raw: any = null;
  let estimatedCredits = 0;
  const limitations = [...routePlan.limitations];
  if (routePlan.primary !== "none" && routePlan.searchSources.length) {
    try {
      const ctx: FcCtx = {
        ...(opts.ctx || {}),
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.toolKey ? { toolKey: opts.toolKey } : {}),
      };
      raw = await fcSearch(query.slice(0, 280), {
        limit, lang: opts.lang, sources: routePlan.searchSources,
      }, ctx);
    } catch {
      raw = null;
      limitations.push("source_retrieval_unavailable");
    }
  } else {
    limitations.push("source_request_not_executed_within_budget");
  }

  const data: any = raw?.data ?? raw;
  const selectedRows: any[] = [];
  for (const sourceType of routePlan.searchSources) {
    const rows = Array.isArray(data?.[sourceType]) ? data[sourceType]
      : Array.isArray(raw?.[sourceType]) ? raw[sourceType] : [];
    for (const row of rows.slice(0, limit)) selectedRows.push(row);
  }
  if (!selectedRows.length && Array.isArray(data) && routePlan.searchSources.includes("web")) {
    selectedRows.push(...data.slice(0, limit));
  }
  if (!selectedRows.length && Array.isArray(raw?.results) && routePlan.searchSources.includes("web")) {
    selectedRows.push(...raw.results.slice(0, limit));
  }
  if (raw?.source_profile_warning === "selected_source_profile_unavailable_on_fallback") {
    limitations.push("selected_source_profile_unavailable_on_fallback");
  }
  const sources: EvidenceSource[] = selectedRows.map((r: any, i: number) => ({
    index: i + 1,
    url: String(r.url || ""),
    title: String(r.title || r.url || "").slice(0, 180),
    snippet: String(r.markdown || r.description || r.snippet || "").slice(0, 500),
    domain: domainOf(r.url || ""),
    fetched_at: retrievedAt,
  })).filter((s) => /^https?:\/\//i.test(s.url));
  if (raw && routePlan.searchSources.length) {
    const estimate = estimateSearchCredits({
      resultCount: sources.length,
      sources: raw?.source_profile_warning ? ["web"] : routePlan.searchSources,
      includePageContent: true,
    });
    estimatedCredits = estimate.estimatedCredits;
  }

  const context_block = sources.length
    ? "EVIDENCE_SOURCES (use ONLY these facts; cite each claim as [n]):\n" +
      sources.map((s) => `[${s.index}] ${s.title} — ${s.domain} (${s.url})\n${s.snippet}`).join("\n\n")
    : "EVIDENCE_SOURCES: (none available — return evidence_missing: true)";
  return {
    sources, query, context_block,
    source_plan: {
      capability: routePlan.capability,
      route: routePlan.primary,
      requested_sources: routePlan.searchSources,
      request_count: raw ? 1 : 0,
      estimated_credits: estimatedCredits,
      sample_size: sources.length,
      budget_limited: limitations.some((reason) => /budget|not_executed/.test(reason)),
      limitations: Array.from(new Set(limitations)),
      retrieved_at: retrievedAt,
    },
  };
}

export function assertEnoughEvidence(pack: EvidencePack, min = 2): boolean {
  return pack.sources.length >= min;
}

/**
 * Build an EvidencePack from already-fetched search results — avoids any
 * additional Firecrawl credits. Use this whenever a route already called fcSearch.
 */
export function evidenceFromResults(
  query: string,
  results: Array<{ title?: string; url: string; snippet?: string; description?: string; domain?: string }>,
  limit = 6,
): EvidencePack {
  const sources: EvidenceSource[] = (results || []).slice(0, limit).map((r, i) => ({
    index: i + 1,
    url: String(r.url || ""),
    title: String(r.title || r.url || "").slice(0, 180),
    snippet: String(r.snippet || r.description || "").slice(0, 500),
    domain: r.domain || domainOf(r.url || ""),
    fetched_at: new Date().toISOString(),
  })).filter((s) => s.url);
  const context_block = sources.length
    ? "EVIDENCE_SOURCES (use ONLY these facts; cite each claim as [n]):\n" +
      sources.map((s) => `[${s.index}] ${s.title} — ${s.domain} (${s.url})\n${s.snippet}`).join("\n\n")
    : "EVIDENCE_SOURCES: (none available — return evidence_missing: true)";
  return { sources, query, context_block };
}

/**
 * Pull the quality fields out of any parsed JSON returned by the model.
 */
export function pickQualityFields(p: any) {
  return {
    sources_used: Array.isArray(p?.sources_used) ? p.sources_used.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)) : [],
    rarity_score: Number.isFinite(Number(p?.rarity_score)) ? Math.max(0, Math.min(100, Math.round(Number(p.rarity_score)))) : null,
    uniqueness_notes: typeof p?.uniqueness_notes === "string" ? String(p.uniqueness_notes).slice(0, 400) : "",
    evidence_missing: !!p?.evidence_missing,
  };
}


/**
 * Wraps a tool-specific system prompt with a strict, anti-hallucination contract
 * and forces the model to emit rarity / uniqueness / evidence fields.
 */
export function qualityShell(systemPrompt: string): string {
  return `${systemPrompt}

STRICT QUALITY CONTRACT (mandatory):
- Use ONLY facts from EVIDENCE_SOURCES the user message provides. NEVER invent numbers, dates, prices, or names.
- Every non-trivial claim MUST cite a source as [n]. Untraceable claims are forbidden.
- Prefer rare, specific, hyper-local, contrarian, or novel insights over generic best-practice advice.
- If sources are missing/insufficient, set "evidence_missing": true and reduce confidence in scores.

ALWAYS include these fields in your JSON output (in addition to whatever else is asked):
  "sources_used": int[]                   // indexes of evidence used (e.g. [1,3])
  "rarity_score": int 0-100               // how uncommon/non-obvious the insights are
  "uniqueness_notes": string              // 1 sentence explaining what makes this analysis non-generic
  "evidence_missing": boolean             // true if EVIDENCE_SOURCES had too little to be confident`;
}
