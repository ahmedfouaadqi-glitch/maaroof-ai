// Server: background research for the second result. Every value comes from a fetched page or an engine reply.
import { fcScrape, fcSearch } from "@/lib/firecrawl";
import { ENGINE_COUNCIL_MODELS } from "@/lib/maaroof/tool-council";
import { completionWithFallback } from "@/lib/maaroof/provider-fallback.server";
import { ENGINE_PERSONA } from "@/lib/ai-engines";
import { keywordVisibilityProbeQuestion, parseProbeContent, hostOf, type ProbeLanguage } from "@/lib/maaroof/probe-answer";
import type { Market } from "@/lib/market-scope";
import type { PartyEvidence, EngineAnswer } from "@/lib/operational-workbook";
import { evidenceCacheKey, getKeywordEvidence, putKeywordEvidence } from "@/lib/keyword-evidence-cache.server";
import { isPlatformUrl } from "@/lib/site-keyword-extractor";

const rowsOf = (r: any): any[] => (r?.data?.web || r?.data || r?.web || []) as any[];

type PageRead = { text: string | null; title: string | null; description: string | null; cacheHit?: boolean };

async function readPage(url: string, userId: string, workspaceId?: string | null): Promise<PageRead> {
  const scope = { userId, workspaceId, evidenceType: "page", evidenceKey: await evidenceCacheKey({ url: String(url || "").trim() }) };
  const cached = await getKeywordEvidence<Omit<PageRead, "cacheHit">>(scope);
  if (cached && (cached.text || cached.title || cached.description)) return { ...cached, cacheHit: true };
  try {
    const r: any = await fcScrape(url, {}, { userId, toolKey: "competitive_geo" });
    const d = r?.data ?? r;
    const page = { text: String(d?.markdown || "").slice(0, 60000) || null, title: d?.metadata?.title || null, description: d?.metadata?.description || null };
    if (page.text || page.title || page.description) await putKeywordEvidence(scope, page);
    return { ...page, cacheHit: false };
  } catch { return { text: null, title: null, description: null, cacheHit: false }; }
}

/** Preflight official-domain evidence so category correction can happen before competitor discovery. */
export async function readOfficialBrandEvidence(url: string, userId: string, workspaceId?: string | null) {
  return readPage(url, userId, workspaceId);
}

async function findSite(name: string, userId: string, workspaceId?: string | null): Promise<string | null> {
  const query = String(name || "").trim() + " official site";
  const scope = { userId, workspaceId, evidenceType: "site-search", evidenceKey: await evidenceCacheKey(query) };
  const cached = await getKeywordEvidence<{ url: string }>(scope);
  if (cached && /^https?:\/\//i.test(cached.url)) return cached.url;
  try {
    const r = rowsOf(await fcSearch(query, { limit: 3 }, { userId, toolKey: "competitive_geo" }));
    const url = String(r[0]?.url || "");
    if (/^https?:\/\//i.test(url)) await putKeywordEvidence(scope, { url });
    return url || null;
  } catch { return null; }
}

export async function gatherParties(o: {
  brand: string; site?: string; competitors: string[]; category: string; markets: Market[]; userId: string;
  brandPageEvidence?: { text: string | null; title: string | null; description: string | null; cacheHit?: boolean };
  workspaceId?: string | null;
}): Promise<PartyEvidence[]> {
  const parties: Array<Omit<PartyEvidence, "pageText">> = [{ name: o.brand, role: "brand", url: o.site || null, found: "user" }];
  for (const c of o.competitors.slice(0, 4)) parties.push({ name: c, role: "competitor", url: null, found: "user" });
  if (o.category && parties.length < 5) {
    // Candidates come from real search results. Social platforms are not commercial competitors.
    const brandHost = o.site ? hostOf(o.site) : "";
    for (const m of o.markets.slice(0, 3)) {
      try {
        const rows = rowsOf(await fcSearch(o.category + " " + m.en, { limit: 6, location: m.en }, { userId: o.userId, toolKey: "competitive_geo" }));
        for (const r of rows) {
          const resultUrl = String(r?.url || "");
          const host = hostOf(resultUrl);
          if (!host || host === brandHost || isPlatformUrl(resultUrl) || parties.some((p) => p.url && hostOf(p.url) === host)) continue;
          parties.push({ name: host, role: "competitor", url: resultUrl, found: "web_search" });
          if (parties.length >= 5) break;
        }
      } catch { /* search failed: no candidate invented */ }
      if (parties.length >= 5) break;
    }
  }

  const resolved = await Promise.all(parties.map(async (party) => {
    const url = party.url || await findSite(party.name, o.userId, o.workspaceId);
    const excludedPlatform = party.role === "competitor" && Boolean(url) && isPlatformUrl(String(url));
    if (excludedPlatform) return { ...party, url, pageText: null, title: null, description: null, additionalPages: [], cacheHit: false, excludedPlatform: true };
    const isOfficialBrandPage = party.role === "brand" && o.brandPageEvidence && url && o.site && hostOf(url) === hostOf(o.site);
    const page = isOfficialBrandPage
      ? o.brandPageEvidence!
      : url ? await readPage(url, o.userId, o.workspaceId) : { text: null, title: null, description: null, cacheHit: false };

    const additionalPages: Array<{ url: string; text: string | null; title?: string | null; description?: string | null }> = [];
    if (party.role === "competitor" && url && !isPlatformUrl(String(url))) {
      const host = hostOf(url);
      const query = "site:" + host + " " + o.category + " (services OR products OR solutions)";
      const searchScope = {
        userId: o.userId, workspaceId: o.workspaceId, evidenceType: "service-page-search",
        evidenceKey: await evidenceCacheKey({ host, category: o.category, market: o.markets[0]?.code || "" }),
      };
      const cachedPageSearch = await getKeywordEvidence<{ urls: string[] }>(searchScope);
      let serviceUrls = cachedPageSearch?.urls || [];
      if (!cachedPageSearch) {
        try {
          const rows = rowsOf(await fcSearch(query, { limit: 5, location: o.markets[0]?.en }, { userId: o.userId, toolKey: "competitive_geo" }));
          const candidates = rows.map((row) => String(row?.url || "")).filter((candidate) => {
            if (!/^https?:\/\//i.test(candidate) || isPlatformUrl(candidate) || hostOf(candidate) !== host || candidate === url) return false;
            try {
              const path = new URL(candidate).pathname.toLocaleLowerCase();
              return path !== "/" && !/\.(pdf|jpg|jpeg|png|webp|svg)(?:$|\?)/i.test(path);
            } catch { return false; }
          });
          serviceUrls = [...new Set(candidates)].sort((a, b) => {
            const preferred = /service|product|solution|what-we-do|our-work|catalog|offer|خدمات|منتج|حلول/i;
            return Number(preferred.test(b)) - Number(preferred.test(a));
          }).slice(0, 1);
          if (serviceUrls.length) await putKeywordEvidence(searchScope, { urls: serviceUrls });
        } catch { serviceUrls = []; }
      }
      for (const serviceUrl of serviceUrls.slice(0, 1)) {
        const servicePage = await readPage(serviceUrl, o.userId, o.workspaceId);
        if (servicePage.text || servicePage.title || servicePage.description) {
          additionalPages.push({ url: serviceUrl, text: servicePage.text, title: servicePage.title, description: servicePage.description });
        }
      }
    }
    return {
      ...party, url, pageText: page.text, title: page.title, description: page.description,
      additionalPages, cacheHit: Boolean(page.cacheHit), excludedPlatform: false,
    };
  }));
  return resolved
    .filter((party) => !party.excludedPlatform)
    .map(({ excludedPlatform: _excludedPlatform, ...party }) => party as PartyEvidence);
}

type EngineCallResult = {
  content: string;
  status: "answered" | "no_answer" | "http_error" | "timeout" | "error" | "empty";
  detail: string;
  providerPath: "primary" | "fallback" | null;
  modelUsed: string | null;
};

async function askEngine(engine: string, model: string, q: string): Promise<EngineCallResult> {
  const system = [
    (ENGINE_PERSONA as any)[engine] || "You are a careful, evidence-based answer engine.",
    'Answer only from what you know. Reply as JSON {"answer": string, "brands": string[], "urls": string[]}. Do not invent URLs.',
  ].join("\n");
  const call = await completionWithFallback({
    primaryModel: model,
    messages: [{ role: "system", content: system }, { role: "user", content: q }],
    primaryKey: process.env.OPENROUTER_API_KEY,
    fallbackKey: process.env.LOVABLE_API_KEY,
    timeoutMs: 30_000,
    acceptContent: (content) => parseProbeContent(content) !== null,
  });
  return {
    content: call.content,
    status: call.status,
    detail: call.error || "",
    providerPath: call.providerPath,
    modelUsed: call.modelUsed,
  };
}

/** Ten engines × each market, the same blind question. No answer stays "no_answer". */
export async function askEnginesPerMarket(category: string, markets: Market[], keywordSamples: Record<string, string[]> = {}, contentLanguage: ProbeLanguage = "en"): Promise<EngineAnswer[]> {
  const jobs = markets.flatMap((m) => ENGINE_COUNCIL_MODELS.map((e) => ({ m, e })));
  return Promise.all(jobs.map(async ({ m, e }): Promise<EngineAnswer> => {
    const marketLabel = contentLanguage === "ar" || contentLanguage === "ku" ? m.ar : m.en;
    const query = keywordVisibilityProbeQuestion(category, marketLabel, keywordSamples[m.code] || [], contentLanguage);
    const call = await askEngine(e.key, e.model, query);
    const parsed = call.status === "answered" ? parseProbeContent(call.content) : null;
    if (parsed) return {
      market: m.code, engine: e.key, status: "answered", answer: parsed.answer, urls: parsed.urls, query,
      provider_path: call.providerPath || undefined, model_used: call.modelUsed || undefined,
    };
    const status = call.status === "answered" ? "empty" : call.status;
    return {
      market: m.code, engine: e.key, status, answer: "", urls: [], query,
      provider_path: call.providerPath || undefined, model_used: call.modelUsed || undefined,
      error: call.detail || "Provider returned no usable answer",
    };
  }));
}

/** Ten engines × each market: one discovery question asking for real customer search phrases. */
export async function askEnginesForDiscovery(o: { brand: string; category: string; markets: Market[]; competitors: string[]; contentLanguage: ProbeLanguage }): Promise<import("@/lib/keyword-discovery").DiscoveryAnswer[]> {
  const { discoveryQuestion } = await import("@/lib/keyword-discovery");
  const jobs = o.markets.flatMap((m) => ENGINE_COUNCIL_MODELS.map((e) => ({ m, e })));
  return Promise.all(jobs.map(async ({ m, e }) => {
    const marketLabel = o.contentLanguage === "ar" || o.contentLanguage === "ku" ? m.ar : m.en;
    const query = discoveryQuestion({ brand: o.brand, category: o.category, market: marketLabel, competitors: o.competitors, lang: o.contentLanguage });
    const call = await askEngine(e.key, e.model, query);
    const parsed = call.status === "answered" ? parseProbeContent(call.content) : null;
    return parsed
      ? { market: m.code, engine: e.key, status: "answered", answer: parsed.answer, query }
      : { market: m.code, engine: e.key, status: call.status === "answered" ? "empty" : call.status, answer: "", query };
  }));
}

/** Public social pages/posts that mention each party (search results only; nothing invented). */
export async function gatherSocial(names: string[], userId: string): Promise<Array<{ party: string; url: string; text: string }>> {
  const out: Array<{ party: string; url: string; text: string }> = [];
  await Promise.all(names.slice(0, 5).map(async (n) => {
    try {
      const rows = rowsOf(await fcSearch(`"${n}" (site:instagram.com OR site:tiktok.com OR site:facebook.com OR site:x.com)`, { limit: 4 }, { userId, toolKey: "competitive_geo" }));
      for (const r of rows) if (r?.url) out.push({ party: n, url: String(r.url), text: `${r.title || ""} ${r.description || ""}` });
    } catch { /* no result recorded */ }
  }));
  return out;
}

/** Ten engines × each keyword cluster: a separate blind question per cluster. */
export async function askEnginesPerCluster(clusters: import("@/lib/keyword-clusters").KeywordCluster[], marketName: (code: string) => string, contentLanguage: ProbeLanguage = "en"): Promise<import("@/lib/keyword-clusters").ClusterAnswer[]> {
  const { clusterQuestion } = await import("@/lib/keyword-clusters");
  const jobs = clusters.flatMap((c) => ENGINE_COUNCIL_MODELS.map((e) => ({ c, e })));
  return Promise.all(jobs.map(async ({ c, e }) => {
    const base = { market: c.market, engine: e.key, keywords: c.keywords };
    const query = clusterQuestion(c, marketName(c.market), contentLanguage);
    const call = await askEngine(e.key, e.model, query);
    const parsed = call.status === "answered" ? parseProbeContent(call.content) : null;
    if (parsed) return {
      ...base, status: "answered" as const, answer: parsed.answer, query,
      provider_path: call.providerPath || undefined, model_used: call.modelUsed || undefined,
    };
    const status = call.status === "answered" ? "empty" : call.status;
    return {
      ...base, status, answer: "", query,
      provider_path: call.providerPath || undefined, model_used: call.modelUsed || undefined,
      error: call.detail || "Provider returned no usable answer",
    };
  }));
}


/** One independent blind visibility probe per sampled keyword × engine, cached per workspace. */
export async function askEnginesForKeywordVisibility(o: {
  category: string;
  markets: Market[];
  keywordsByMarket: Record<string, string[]>;
  contentLanguage: ProbeLanguage;
  userId: string;
  workspaceId?: string | null;
  /** When true, read prior evidence only and never call a provider on a cache miss. */
  cacheOnly?: boolean;
}): Promise<EngineAnswer[]> {
  const jobs = o.markets.flatMap((market) =>
    (o.keywordsByMarket[market.code] || []).map((keyword) => ({ market, keyword }))
      .flatMap(({ market, keyword }) => ENGINE_COUNCIL_MODELS.map((engine) => ({ market, keyword, engine })))
  );
  return Promise.all(jobs.map(async ({ market, keyword, engine }): Promise<EngineAnswer> => {
    const marketLabel = o.contentLanguage === "ar" || o.contentLanguage === "ku" ? market.ar : market.en;
    const query = keywordVisibilityProbeQuestion(o.category, marketLabel, [keyword], o.contentLanguage);
    const scope = {
      userId: o.userId,
      workspaceId: o.workspaceId,
      evidenceType: "keyword-engine-probe",
      evidenceKey: await evidenceCacheKey({ market: market.code, keyword, engine: engine.key, model: engine.model, query }),
    };
    const cached = await getKeywordEvidence<EngineAnswer>(scope);
    // Reuse both successful responses and recorded failures until their cache TTL expires.
    if (cached && cached.status) return { ...cached, cacheHit: true };
    // Expanded samples must restore prior results without silently re-running paid calls.
    // A missing/expired cache entry remains explicitly unmeasured in the resulting report.
    if (o.cacheOnly) return {
      market: market.code, engine: engine.key, status: "no_answer", answer: "", urls: [], query,
      error: "cached_evidence_unavailable_not_requeried", cacheHit: true, probe_kind: "keyword_visibility",
    };
    const call = await askEngine(engine.key, engine.model, query);
    const parsed = call.status === "answered" ? parseProbeContent(call.content) : null;
    const answer: EngineAnswer = parsed ? {
      market: market.code, engine: engine.key, status: "answered", answer: parsed.answer, urls: parsed.urls, query,
      provider_path: call.providerPath || undefined, model_used: call.modelUsed || undefined, cacheHit: false, probe_kind: "keyword_visibility",
    } : {
      market: market.code, engine: engine.key, status: call.status === "answered" ? "empty" : call.status as any,
      answer: "", urls: [], query, provider_path: call.providerPath || undefined,
      model_used: call.modelUsed || undefined, error: call.detail || "Provider returned no usable answer", cacheHit: false, probe_kind: "keyword_visibility",
    };
    // Preserve failure status too, so expanding a sample does not repeat provider calls silently.
    await putKeywordEvidence(scope, { ...answer, cacheHit: undefined }, parsed ? 24 : 6);
    return answer;
  }));
}

/**
 * Optional Alexandria evidence source. Connected only when ALEXANDRIA_API_URL is configured and answers.
 * Any failure keeps it "not connected" — no substitute data is produced.
 */
export async function gatherAlexandria(query: string): Promise<{ connected: boolean; note?: string; evidence: Array<{ url: string; text: string }> }> {
  const url = process.env.ALEXANDRIA_API_URL;
  if (!url || !/^https:\/\//i.test(url)) return { connected: false, evidence: [] };
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.ALEXANDRIA_API_KEY) headers.Authorization = `Bearer ${process.env.ALEXANDRIA_API_KEY}`;
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query }), signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return { connected: false, note: `HTTP ${r.status}`, evidence: [] };
    const j: any = await r.json().catch(() => null);
    const rows: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.results) ? j.results : [];
    const evidence = rows.map((x) => ({ url: String(x?.url || x?.source || ""), text: String(x?.text || x?.content || x?.markdown || "").slice(0, 4000) })).filter((x) => /^https?:\/\//.test(x.url) && x.text);
    return evidence.length ? { connected: true, note: `${evidence.length}`, evidence } : { connected: false, note: "no_evidence", evidence: [] };
  } catch { return { connected: false, note: "unreachable", evidence: [] }; }
}
