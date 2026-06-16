// Server-only helpers that push every tool toward "rare, unique, authentic" output.
// - buildEvidencePack: real sources via Firecrawl search.
// - assertEvidence: fail loudly when there is no real-world grounding.
// - qualityShell: appends a strict citation contract to any system prompt.
import { fcSearch, type FcCtx } from "./firecrawl";

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
};

function domainOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export async function buildEvidencePack(
  query: string,
  opts: { limit?: number; lang?: string; ctx?: FcCtx } = {},
): Promise<EvidencePack> {
  const limit = Math.min(opts.limit ?? 4, 6);
  let raw: any = null;
  try { raw = await fcSearch(query.slice(0, 280), { limit, lang: opts.lang }, opts.ctx || {}); }
  catch { raw = null; }

  const pickArr = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return [...(v.web || []), ...(v.news || [])];
    return [];
  };
  const list = (pickArr(raw?.data).length ? pickArr(raw.data) : pickArr(raw?.web)).slice(0, limit);
  const sources: EvidenceSource[] = list.map((r: any, i: number) => ({
    index: i + 1,
    url: String(r.url || ""),
    title: String(r.title || r.url || "").slice(0, 180),
    snippet: String(r.markdown || r.description || "").slice(0, 500),
    domain: domainOf(r.url || ""),
    fetched_at: new Date().toISOString(),
  })).filter((s) => s.url);

  const context_block = sources.length
    ? "EVIDENCE_SOURCES (use ONLY these facts; cite each claim as [n]):\n" +
      sources.map((s) => `[${s.index}] ${s.title} — ${s.domain} (${s.url})\n${s.snippet}`).join("\n\n")
    : "EVIDENCE_SOURCES: (none available — return evidence_missing: true)";

  return { sources, query, context_block };
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
