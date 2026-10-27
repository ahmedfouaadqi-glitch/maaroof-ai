// Server: background research for the second result. Every value comes from a fetched page or an engine reply.
import { fcScrape, fcSearch } from "@/lib/firecrawl";
import { ENGINE_COUNCIL_MODELS } from "@/lib/maaroof/tool-council";
import { OPENROUTER_URL } from "@/lib/maaroof/openrouter.server";
import { keywordVisibilityProbeQuestion, parseProbeContent, hostOf } from "@/lib/maaroof/probe-answer";
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

async function askEngine(model: string, q: string, key: string): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://maaroofai.com", "X-Title": "Maaroof AI" },
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: 900, messages: [{ role: "system", content: 'Answer only from what you know. Reply as JSON {"answer": string, "brands": string[], "urls": string[]}. Do not invent URLs.' }, { role: "user", content: q }] }),
  });
  if (!res.ok) return "";
  const j: any = await res.json().catch(() => null);
  return String(j?.choices?.[0]?.message?.content || "");
}

/** Ten engines × each market, the same blind question. No answer stays "no_answer". */
export async function askEnginesPerMarket(category: string, markets: Market[], keywordSamples: Record<string, string[]> = {}): Promise<EngineAnswer[]> {
  const key = process.env.OPENROUTER_API_KEY;
  const jobs = markets.flatMap((m) => ENGINE_COUNCIL_MODELS.map((e) => ({ m, e })));
  return Promise.all(jobs.map(async ({ m, e }): Promise<EngineAnswer> => {
    if (!key) return { market: m.code, engine: e.key, status: "no_answer", answer: "", urls: [] };
    try {
      const p = parseProbeContent(await askEngine(e.model, keywordVisibilityProbeQuestion(category, m.en, keywordSamples[m.code] || []), key));
      return p ? { market: m.code, engine: e.key, status: "answered", answer: p.answer, urls: p.urls } : { market: m.code, engine: e.key, status: "no_answer", answer: "", urls: [] };
    } catch { return { market: m.code, engine: e.key, status: "no_answer", answer: "", urls: [] }; }
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
  const key = process.env.OPENROUTER_API_KEY;
  const { clusterQuestion } = await import("@/lib/keyword-clusters");
  const jobs = clusters.flatMap((c) => ENGINE_COUNCIL_MODELS.map((e) => ({ c, e })));
  return Promise.all(jobs.map(async ({ c, e }) => {
    const base = { market: c.market, engine: e.key, keywords: c.keywords };
    if (!key) return { ...base, status: "no_answer" as const, answer: "" };
    try {
      const p = parseProbeContent(await askEngine(e.model, clusterQuestion(c, marketName(c.market)), key));
      return p ? { ...base, status: "answered" as const, answer: p.answer } : { ...base, status: "no_answer" as const, answer: "" };
    } catch { return { ...base, status: "no_answer" as const, answer: "" }; }
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
