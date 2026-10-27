// Server: background research for the second result. Every value comes from a fetched page or an engine reply.
import { fcScrape, fcSearch } from "@/lib/firecrawl";
import { ENGINE_COUNCIL_MODELS } from "@/lib/maaroof/tool-council";
import { completionWithFallback } from "@/lib/maaroof/provider-fallback.server";
import { ENGINE_PERSONA } from "@/lib/ai-engines";
import { keywordVisibilityProbeQuestion, parseProbeContent, hostOf } from "@/lib/maaroof/probe-answer";
import type { Market } from "@/lib/market-scope";
import type { PartyEvidence, EngineAnswer, DiscoveredKeyword, KeywordSearchEvidence } from "@/lib/operational-workbook";

const rowsOf = (r: any): any[] => (r?.data?.web || r?.data || r?.web || []) as any[];

async function readPage(url: string, userId: string) {
  try {
    const r: any = await fcScrape(url, {}, { userId, toolKey: "competitive_geo" });
    const d = r?.data ?? r;
    return { text: String(d?.markdown || "").slice(0, 60000) || null, title: d?.metadata?.title || null, description: d?.metadata?.description || null };
  } catch { return { text: null, title: null, description: null }; }
}

async function findSite(name: string, userId: string): Promise<string | null> {
  try { const r = rowsOf(await fcSearch(`${name} official site`, { limit: 3 }, { userId, toolKey: "competitive_geo" })); return r[0]?.url || null; } catch { return null; }
}

export async function gatherParties(o: { brand: string; site?: string; competitors: string[]; category: string; markets: Market[]; userId: string }): Promise<PartyEvidence[]> {
  const parties: Array<Omit<PartyEvidence, "pageText">> = [{ name: o.brand, role: "brand", url: o.site || null, found: "user" }];
  for (const c of o.competitors.slice(0, 4)) parties.push({ name: c, role: "competitor", url: null, found: "user" });
  if (o.category && parties.length < 5) {
    // Candidates from a real web search per market; each keeps its result url.
    const brandHost = o.site ? hostOf(o.site) : "";
    for (const m of o.markets.slice(0, 3)) {
      try {
        const rows = rowsOf(await fcSearch(`${o.category} ${m.en}`, { limit: 6, location: m.en }, { userId: o.userId, toolKey: "competitive_geo" }));
        for (const r of rows) {
          const h = hostOf(String(r?.url || ""));
          if (!h || h === brandHost || parties.some((p) => p.url && hostOf(p.url) === h)) continue;
          parties.push({ name: h, role: "competitor", url: r.url, found: "web_search" });
          if (parties.length >= 5) break;
        }
      } catch { /* search failed: no candidate invented */ }
      if (parties.length >= 5) break;
    }
  }
  return Promise.all(parties.map(async (p) => {
    const url = p.url || (await findSite(p.name, o.userId));
    const pg = url ? await readPage(url, o.userId) : { text: null, title: null, description: null };
    return { ...p, url, pageText: pg.text, title: pg.title, description: pg.description };
  }));
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
export async function askEnginesPerMarket(category: string, markets: Market[], keywordSamples: Record<string, string[]> = {}): Promise<EngineAnswer[]> {
  const jobs = markets.flatMap((m) => ENGINE_COUNCIL_MODELS.map((e) => ({ m, e })));
  return Promise.all(jobs.map(async ({ m, e }): Promise<EngineAnswer> => {
    const query = keywordVisibilityProbeQuestion(category, m.en, keywordSamples[m.code] || []);
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
export async function askEnginesPerCluster(clusters: import("@/lib/keyword-clusters").KeywordCluster[], marketName: (code: string) => string): Promise<import("@/lib/keyword-clusters").ClusterAnswer[]> {
  const { clusterQuestion } = await import("@/lib/keyword-clusters");
  const jobs = clusters.flatMap((c) => ENGINE_COUNCIL_MODELS.map((e) => ({ c, e })));
  return Promise.all(jobs.map(async ({ c, e }) => {
    const base = { market: c.market, engine: e.key, keywords: c.keywords };
    const query = clusterQuestion(c, marketName(c.market), c.keywords.some((k) => /[\u0600-\u06FF]/.test(k)) ? "ar" : "en");
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

type KeywordSourceRecord = {
  id: string;
  source_type: "website" | "competitor" | "social" | "web_search";
  entity: string;
  market: string;
  title: string;
  url: string;
  text: string;
};

/**
 * Reuses the existing crawler/search and gateway route to discover current terms
 * and grounded opportunities. Actual page/social terms must occur in their cited
 * source text; only opportunity terms may be inferred from that evidence.
 */
export async function discoverKeywordIdeas(o: {
  brand: string;
  category: string;
  markets: Market[];
  parties: PartyEvidence[];
  social: Array<{ party: string; url: string; text: string }>;
  existingKeywords: string[];
  userId: string;
  lang: "ar" | "en" | "ku";
}): Promise<{ terms: DiscoveredKeyword[]; searchEvidence: KeywordSearchEvidence[] }> {
  const searches = await Promise.all(o.markets.slice(0, 5).map(async (market) => {
    const query = `"${o.brand}" ${o.category} products services styles features questions ${market.en}`.trim();
    try {
      const result: any = await fcSearch(query, { limit: 5, lang: o.lang === "ku" ? "en" : o.lang, location: market.en }, { userId: o.userId, toolKey: "competitive_geo" });
      const rows = rowsOf(result).slice(0, 5);
      return rows.map((r: any) => ({
        market: market.code,
        title: String(r?.title || "").trim().slice(0, 180),
        url: String(r?.url || "").trim().slice(0, 500),
        text: String(r?.description || r?.snippet || "").replace(/\\s+/g, " ").trim().slice(0, 500),
      })).filter((r) => /^https?:\\/\\//i.test(r.url) && (r.title || r.text));
    } catch {
      return [] as Array<{ market: string; title: string; url: string; text: string }>;
    }
  }));
  const searchRows = searches.flat();
  let nextId = 1;
  const sources: KeywordSourceRecord[] = [];
  const sourceByKey = new Map<string, KeywordSourceRecord>();
  const addSource = (row: Omit<KeywordSourceRecord, "id">) => {
    const key = [row.source_type, row.entity, row.market, row.url].join("|");
    const old = sourceByKey.get(key);
    if (old) return old;
    const source = { ...row, id: "S" + nextId++ };
    sources.push(source);
    sourceByKey.set(key, source);
    return source;
  };
  for (const p of o.parties) {
    if (!p.pageText && !p.title && !p.description) continue;
    addSource({
      source_type: p.role === "brand" ? "website" : "competitor",
      entity: p.name,
      market: "all",
      title: String(p.title || p.name).slice(0, 180),
      url: String(p.url || ""),
      text: [p.title, p.description, p.pageText].filter(Boolean).join("\\n").slice(0, 5000),
    });
  }
  for (const post of o.social.slice(0, 30)) {
    addSource({
      source_type: "social",
      entity: post.party,
      market: "all",
      title: post.party + " public social result",
      url: post.url,
      text: post.text.slice(0, 700),
    });
  }
  for (const r of searchRows) {
    addSource({
      source_type: "web_search",
      entity: r.title || r.url,
      market: r.market,
      title: r.title,
      url: r.url,
      text: r.text,
    });
  }
  const searchEvidence: KeywordSearchEvidence[] = sources.map((x) => ({
    market: x.market,
    source_type: x.source_type,
    entity: x.entity,
    title: x.title,
    url: x.url,
    text: x.text.slice(0, 700),
  }));
  if (!sources.length) return { terms: [], searchEvidence };

  const sourceContext = sources.map((x) => ({
    id: x.id,
    type: x.source_type,
    entity: x.entity,
    market: x.market,
    title: x.title,
    url: x.url,
    text: x.text.slice(0, 1800),
  }));
  const langName = o.lang === "ar" ? "Arabic" : o.lang === "ku" ? "Kurdish Sorani" : "English";
  const prompt = [
    "You are MAAROOF Ai's keyword discovery specialist. Return JSON only.",
    "Find useful search phrases for the brand's real products/services, including long-tail buyer queries and natural-language questions.",
    "Use the supplied source records only. Never invent URLs, search volumes, CPC, rankings, or numeric metrics.",
    "Return up to 15 brand_current_keywords, 15 competitor_keywords, 10 social_keywords, and 25 new_opportunities per market, prioritizing relevance and variety.",
    "brand_current_keywords must appear literally in the brand website source text.",
    "competitor_keywords must appear literally in that competitor's source text; include exact party and source_id.",
    "social_keywords must appear literally in a supplied social result; include the exact source_id.",
    "new_opportunities are useful phrases not already in the existing workbook list. They may be new query formulations informed by the supplied evidence, but must cite a source_id that grounds the product/category/market. Do not claim the exact phrase appeared in that source.",
    "Preserve the market code. Suggest the requested report language (" + langName + ") and appropriate English/local-language variants when supported by market context.",
    "Existing workbook keywords: " + JSON.stringify(o.existingKeywords.slice(0, 250)),
    "Markets: " + JSON.stringify(o.markets.map((m) => ({ code: m.code, name: m.en, local_name: m.ar }))),
    "Source records: " + JSON.stringify(sourceContext),
    "Return exact schema: {brand_current_keywords:[{keyword,market,intent,language,source_id}],competitor_keywords:[{keyword,market,intent,language,party,source_id}],social_keywords:[{keyword,market,intent,language,party,source_id}],new_opportunities:[{keyword,market,intent,language,rationale,source_id}]}.",
  ].join("\\n");

  let parsed: any = null;
  try {
    const model = ENGINE_COUNCIL_MODELS[0]?.model || "google/gemini-2.5-pro";
    const call = await completionWithFallback({
      primaryModel: model,
      messages: [
        { role: "system", content: "You are a strict evidence-grounded SEO/GEO/AEO keyword researcher. Output valid JSON only. Do not invent metrics or source URLs." },
        { role: "user", content: prompt },
      ],
      primaryKey: process.env.OPENROUTER_API_KEY,
      fallbackKey: process.env.LOVABLE_API_KEY,
      timeoutMs: 45_000,
      acceptContent: (content) => {
        try {
          const raw = String(content || "");
          const start = raw.indexOf("{");
          const end = raw.lastIndexOf("}");
          if (start < 0 || end <= start) return false;
          const obj = JSON.parse(raw.slice(start, end + 1));
          return !!obj && typeof obj === "object" && (Array.isArray(obj.new_opportunities) || Array.isArray(obj.brand_current_keywords));
        } catch { return false; }
      },
    });
    const raw = String(call.content || "");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    parsed = null;
  }
  if (!parsed) return { terms: [], searchEvidence };

  const sourceMap = new Map(sources.map((x) => [x.id, x]));
  const existing = new Set(o.existingKeywords.map((x) => x.toLowerCase().trim()));
  const pageTextFor = (x: KeywordSourceRecord) => x.text.toLocaleLowerCase();
  const terms: DiscoveredKeyword[] = [];
  const seen = new Set<string>();
  const add = (item: any, kind: DiscoveredKeyword["kind"]) => {
    const keyword = String(item?.keyword || "").replace(/\\s+/g, " ").trim().slice(0, 180);
    const market = o.markets.find((m) => m.code === String(item?.market || "")) || (o.markets.length === 1 ? o.markets[0] : null);
    const source = sourceMap.get(String(item?.source_id || ""));
    if (!keyword || keyword.length < 3 || !market || !source) return;
    if (kind !== "opportunity" && !pageTextFor(source).includes(keyword.toLocaleLowerCase())) return;
    if (kind === "opportunity" && existing.has(keyword.toLowerCase())) return;
    if (kind === "brand" && source.source_type !== "website") return;
    if (kind === "competitor" && source.source_type !== "competitor") return;
    if (kind === "social" && source.source_type !== "social") return;
    if ((kind === "brand" || kind === "competitor" || kind === "social") && source.url && !/^https?:\\/\\//i.test(source.url)) return;
    const key = [market.code, kind, keyword.toLowerCase(), source.url].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    terms.push({
      keyword,
      market: market.code,
      kind,
      intent: String(item?.intent || "").slice(0, 100),
      language: String(item?.language || o.lang).slice(0, 40),
      party: String(item?.party || source.entity).slice(0, 160),
      source: kind === "opportunity" ? "Opportunity based on " + source.title : source.source_type === "website" ? "Brand website" : source.source_type === "competitor" ? "Competitor website" : "Public social result",
      url: source.url || undefined,
      rationale: String(item?.rationale || "").slice(0, 400),
    });
  };
  for (const x of (Array.isArray(parsed.brand_current_keywords) ? parsed.brand_current_keywords : []).slice(0, 100)) add(x, "brand");
  for (const x of (Array.isArray(parsed.competitor_keywords) ? parsed.competitor_keywords : []).slice(0, 120)) add(x, "competitor");
  for (const x of (Array.isArray(parsed.social_keywords) ? parsed.social_keywords : []).slice(0, 80)) add(x, "social");
  for (const x of (Array.isArray(parsed.new_opportunities) ? parsed.new_opportunities : []).slice(0, 120)) add(x, "opportunity");
  return { terms, searchEvidence };
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
