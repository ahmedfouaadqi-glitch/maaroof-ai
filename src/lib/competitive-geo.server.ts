// Server: background research for the second result. Every value comes from a fetched page or an engine reply.
import { fcScrape, fcSearch } from "@/lib/firecrawl";
import { ENGINE_COUNCIL_MODELS } from "@/lib/maaroof/tool-council";
import { completionWithFallback } from "@/lib/maaroof/provider-fallback.server";
import { ENGINE_PERSONA } from "@/lib/ai-engines";
import { keywordVisibilityProbeQuestion, parseProbeContent, hostOf, type ProbeLanguage } from "@/lib/maaroof/probe-answer";
import type { Market } from "@/lib/market-scope";
import type { PartyEvidence, EngineAnswer } from "@/lib/operational-workbook";

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
