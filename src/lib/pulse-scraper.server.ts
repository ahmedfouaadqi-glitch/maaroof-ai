// Pulse data scrapers. Each source has a dedicated scraper that returns normalized
// metric rows. Firecrawl is used for HTML/markdown extraction; World Bank uses its
// open API directly. All scrapers are best-effort: a failure in one source does
// NOT block the others.
import Firecrawl from "@mendable/firecrawl-js";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, extractJsonObject } from "@/lib/lovable-ai";

export type PulseSourceRow = {
  id: string;
  key: string;
  url: string;
  scrape_config: { kind?: string; formats?: string[] };
};

export type GovernorateRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  population_base: number | null;
};

export type NormalizedMetric = {
  governorate_id: string | null;
  metric_key: string;
  sector: string;
  value: number | null;
  unit: string | null;
  meta?: Record<string, unknown>;
};

export type NormalizedTrendingApp = {
  governorate_id: string | null;
  app_name: string;
  category: string | null;
  rank: number;
  score: number | null;
};

export type ScrapeResult = {
  rawPayload: unknown;
  metrics: NormalizedMetric[];
  trendingApps?: NormalizedTrendingApp[];
};

function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");
  return new Firecrawl({ apiKey });
}

async function safeScrape(url: string): Promise<string> {
  const fc = getFirecrawl();
  const res: any = await fc.scrape(url, { formats: ["markdown"], onlyMainContent: true });
  return String(res?.markdown ?? res?.data?.markdown ?? "");
}

/** Ask Lovable AI to extract structured numbers from raw markdown — JSON only, no invention. */
async function aiExtract<T>(prompt: string, markdown: string): Promise<T | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const slice = markdown.slice(0, 12000);
  try {
    const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: lovableAiHeaders(apiKey),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract structured numeric facts from public source pages. " +
              "Return STRICT JSON only. NEVER invent numbers — if a field is not present in the source, omit it. " +
              "Use ISO governorate slugs from this list: baghdad, basra, nineveh, erbil, sulaymaniyah, duhok, kirkuk, anbar, babil, karbala, najaf, wasit, diyala, saladin, qadisiyyah, muthanna, dhi-qar, maysan.",
          },
          { role: "user", content: `${prompt}\n\nSOURCE MARKDOWN:\n${slice}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "");
    return extractJsonObject<T>(content);
  } catch {
    return null;
  }
}

function findGovId(govs: GovernorateRow[], slugOrName: string): string | null {
  const s = (slugOrName || "").trim().toLowerCase();
  if (!s) return null;
  const g = govs.find(
    (x) => x.slug === s || x.name_en.toLowerCase() === s || x.name_ar.includes(slugOrName),
  );
  return g?.id ?? null;
}

/** Safely coerce an AI response field into an array — AI sometimes returns object/null. */
function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    for (const k of ["items", "data", "results", "list"]) {
      if (Array.isArray(obj[k])) return obj[k] as T[];
    }
  }
  return [];
}

// ------------------- Per-source scrapers -------------------

async function scrapeCosit(source: PulseSourceRow, govs: GovernorateRow[]): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{ population_by_governorate?: { slug: string; value: number }[] }>(
    "Find current population estimates per Iraqi governorate. Return JSON {population_by_governorate:[{slug,value}]}.",
    md,
  );
  const rows: NormalizedMetric[] = [];
  for (const r of extracted?.population_by_governorate || []) {
    const gid = findGovId(govs, r.slug);
    if (gid && Number.isFinite(r.value)) {
      rows.push({ governorate_id: gid, metric_key: "population", sector: "population", value: r.value, unit: "people" });
    }
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeCmc(source: PulseSourceRow, govs: GovernorateRow[]): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{
    internet_penetration_pct?: number;
    mobile_subscribers?: number;
    per_governorate?: { slug: string; internet_subscribers?: number }[];
  }>(
    "Find Iraqi internet/mobile subscriber numbers. Return JSON {internet_penetration_pct, mobile_subscribers, per_governorate:[{slug,internet_subscribers}]}.",
    md,
  );
  const rows: NormalizedMetric[] = [];
  if (Number.isFinite(extracted?.internet_penetration_pct)) {
    rows.push({
      governorate_id: null,
      metric_key: "internet_penetration_pct",
      sector: "telecom",
      value: extracted!.internet_penetration_pct!,
      unit: "%",
    });
  }
  if (Number.isFinite(extracted?.mobile_subscribers)) {
    rows.push({
      governorate_id: null,
      metric_key: "mobile_subscribers",
      sector: "telecom",
      value: extracted!.mobile_subscribers!,
      unit: "people",
    });
  }
  for (const r of extracted?.per_governorate || []) {
    const gid = findGovId(govs, r.slug);
    if (gid && Number.isFinite(r.internet_subscribers)) {
      rows.push({
        governorate_id: gid,
        metric_key: "internet_subscribers",
        sector: "telecom",
        value: r.internet_subscribers!,
        unit: "people",
      });
    }
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeIsx(source: PulseSourceRow): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{
    isx_index?: number;
    traded_volume?: number;
    traded_value_iqd?: number;
  }>(
    "Find the latest ISX general index value, traded volume (shares), and traded value (IQD). Return JSON.",
    md,
  );
  const rows: NormalizedMetric[] = [];
  if (Number.isFinite(extracted?.isx_index)) {
    rows.push({ governorate_id: null, metric_key: "isx_index", sector: "isx", value: extracted!.isx_index!, unit: "pts" });
  }
  if (Number.isFinite(extracted?.traded_volume)) {
    rows.push({ governorate_id: null, metric_key: "isx_volume", sector: "isx", value: extracted!.traded_volume!, unit: "shares" });
  }
  if (Number.isFinite(extracted?.traded_value_iqd)) {
    rows.push({ governorate_id: null, metric_key: "isx_value", sector: "isx", value: extracted!.traded_value_iqd!, unit: "IQD" });
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeGoogleTrends(_source: PulseSourceRow, govs: GovernorateRow[]): Promise<ScrapeResult> {
  // Trends without an API needs JS. Try the public RSS-like daily trends page first.
  const url = "https://trends.google.com/trends/trendingsearches/daily?geo=IQ";
  const md = await safeScrape(url);
  const extracted = await aiExtract<{
    trending_queries?: { query: string; volume?: number }[];
    per_governorate?: { slug: string; query: string }[];
  }>(
    "List the top trending search queries in Iraq today (max 20). If any are tied to a specific governorate, list them in per_governorate.",
    md,
  );
  const rows: NormalizedMetric[] = [];
  let rank = 1;
  for (const q of (extracted?.trending_queries || []).slice(0, 20)) {
    rows.push({
      governorate_id: null,
      metric_key: "trending_query",
      sector: "search_trends",
      value: q.volume ?? null,
      unit: q.volume ? "searches" : null,
      meta: { query: q.query, rank: rank++ },
    });
  }
  for (const r of extracted?.per_governorate || []) {
    const gid = findGovId(govs, r.slug);
    if (gid) {
      rows.push({
        governorate_id: gid,
        metric_key: "trending_query_local",
        sector: "search_trends",
        value: null,
        unit: null,
        meta: { query: r.query },
      });
    }
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeHdx(source: PulseSourceRow): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{
    datasets?: { title: string; org?: string; last_update?: string }[];
  }>("List the most recent HDX datasets about Iraq (title, organization, last update).", md);
  const rows: NormalizedMetric[] = [];
  let rank = 1;
  for (const d of (extracted?.datasets || []).slice(0, 10)) {
    rows.push({
      governorate_id: null,
      metric_key: "hdx_dataset",
      sector: "humanitarian",
      value: null,
      unit: null,
      meta: { title: d.title, org: d.org, last_update: d.last_update, rank: rank++ },
    });
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeIomDtm(source: PulseSourceRow, govs: GovernorateRow[]): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{
    total_idps?: number;
    total_returnees?: number;
    per_governorate?: { slug: string; idps?: number; returnees?: number }[];
  }>("Find IDP and returnee totals for Iraq from IOM DTM, including per-governorate breakdown. Return JSON.", md);
  const rows: NormalizedMetric[] = [];
  if (Number.isFinite(extracted?.total_idps)) {
    rows.push({ governorate_id: null, metric_key: "idps_total", sector: "humanitarian", value: extracted!.total_idps!, unit: "people" });
  }
  if (Number.isFinite(extracted?.total_returnees)) {
    rows.push({ governorate_id: null, metric_key: "returnees_total", sector: "humanitarian", value: extracted!.total_returnees!, unit: "people" });
  }
  for (const r of extracted?.per_governorate || []) {
    const gid = findGovId(govs, r.slug);
    if (!gid) continue;
    if (Number.isFinite(r.idps)) rows.push({ governorate_id: gid, metric_key: "idps", sector: "humanitarian", value: r.idps!, unit: "people" });
    if (Number.isFinite(r.returnees)) rows.push({ governorate_id: gid, metric_key: "returnees", sector: "humanitarian", value: r.returnees!, unit: "people" });
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeWorldBank(_source: PulseSourceRow): Promise<ScrapeResult> {
  // World Bank free API — no Firecrawl needed.
  const indicators: { code: string; key: string; sector: string; unit: string }[] = [
    { code: "NY.GDP.MKTP.CD", key: "gdp_current_usd", sector: "economy", unit: "USD" },
    { code: "FP.CPI.TOTL.ZG", key: "inflation_pct", sector: "economy", unit: "%" },
    { code: "SP.POP.TOTL", key: "population_total", sector: "population", unit: "people" },
    { code: "IT.NET.USER.ZS", key: "internet_users_pct", sector: "telecom", unit: "%" },
    { code: "SL.UEM.TOTL.ZS", key: "unemployment_pct", sector: "employment", unit: "%" },
  ];
  const rows: NormalizedMetric[] = [];
  const raw: Record<string, unknown> = {};
  for (const ind of indicators) {
    try {
      const r = await fetch(`https://api.worldbank.org/v2/country/IRQ/indicator/${ind.code}?format=json&per_page=5`);
      const j: any = await r.json();
      const latest = (j?.[1] || []).find((x: any) => x?.value != null);
      raw[ind.code] = latest;
      if (latest && Number.isFinite(latest.value)) {
        rows.push({
          governorate_id: null,
          metric_key: ind.key,
          sector: ind.sector,
          value: latest.value,
          unit: ind.unit,
          meta: { year: latest.date, indicator: ind.code },
        });
      }
    } catch {
      /* ignore one indicator */
    }
  }
  return { rawPayload: raw, metrics: rows };
}

async function scrapeCbi(source: PulseSourceRow): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{ usd_iqd_rate?: number; inflation_pct?: number; policy_rate_pct?: number }>(
    "Find the latest Central Bank of Iraq USD/IQD exchange rate, inflation, and policy rate. Return JSON.",
    md,
  );
  const rows: NormalizedMetric[] = [];
  if (Number.isFinite(extracted?.usd_iqd_rate)) {
    rows.push({ governorate_id: null, metric_key: "usd_iqd", sector: "currency", value: extracted!.usd_iqd_rate!, unit: "IQD/USD" });
  }
  if (Number.isFinite(extracted?.inflation_pct)) {
    rows.push({ governorate_id: null, metric_key: "cbi_inflation", sector: "currency", value: extracted!.inflation_pct!, unit: "%" });
  }
  if (Number.isFinite(extracted?.policy_rate_pct)) {
    rows.push({ governorate_id: null, metric_key: "policy_rate", sector: "currency", value: extracted!.policy_rate_pct!, unit: "%" });
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeMoP(source: PulseSourceRow, govs: GovernorateRow[]): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{
    projects?: { governorate_slug?: string; sector?: string; title?: string }[];
  }>("List recent Iraqi Ministry of Planning projects/reports with governorate and sector. Return JSON.", md);
  const rows: NormalizedMetric[] = [];
  for (const p of (extracted?.projects || []).slice(0, 20)) {
    const gid = p.governorate_slug ? findGovId(govs, p.governorate_slug) : null;
    rows.push({
      governorate_id: gid,
      metric_key: "mop_project",
      sector: p.sector || "infrastructure",
      value: null,
      unit: null,
      meta: { title: p.title, sector: p.sector },
    });
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows };
}

async function scrapeTrendingApps(source: PulseSourceRow, govs: GovernorateRow[]): Promise<ScrapeResult> {
  const md = await safeScrape(source.url);
  const extracted = await aiExtract<{
    top_apps?: { app: string; category?: string; rank?: number; score?: number }[];
    per_governorate?: { slug: string; app: string; rank?: number }[];
  }>(
    "List the top trending apps in Iraq right now (max 20) with category and rank. If any data ties to a specific governorate include per_governorate. Return JSON.",
    md,
  );
  const rows: NormalizedMetric[] = [];
  const apps: NormalizedTrendingApp[] = [];
  let rank = 1;
  for (const a of (extracted?.top_apps || []).slice(0, 20)) {
    apps.push({
      governorate_id: null,
      app_name: a.app,
      category: a.category || null,
      rank: a.rank ?? rank++,
      score: Number.isFinite(a.score) ? a.score! : null,
    });
  }
  for (const a of extracted?.per_governorate || []) {
    const gid = findGovId(govs, a.slug);
    if (gid) {
      apps.push({
        governorate_id: gid,
        app_name: a.app,
        category: null,
        rank: a.rank ?? 99,
        score: null,
      });
    }
  }
  // Also push a summary metric
  if (apps.length > 0) {
    rows.push({
      governorate_id: null,
      metric_key: "trending_apps_count",
      sector: "apps",
      value: apps.length,
      unit: "apps",
    });
  }
  return { rawPayload: { markdown_chars: md.length, extracted }, metrics: rows, trendingApps: apps };
}

// ------------------- Dispatcher -------------------

export async function scrapeSource(
  source: PulseSourceRow,
  govs: GovernorateRow[],
): Promise<ScrapeResult> {
  switch (source.key) {
    case "cosit": return scrapeCosit(source, govs);
    case "cmc": return scrapeCmc(source, govs);
    case "isx": return scrapeIsx(source);
    case "google_trends": return scrapeGoogleTrends(source, govs);
    case "hdx": return scrapeHdx(source);
    case "iom_dtm": return scrapeIomDtm(source, govs);
    case "world_bank": return scrapeWorldBank(source);
    case "cbi": return scrapeCbi(source);
    case "mop": return scrapeMoP(source, govs);
    case "trending_apps": return scrapeTrendingApps(source, govs);
    default: throw new Error(`Unknown source key: ${source.key}`);
  }
}
