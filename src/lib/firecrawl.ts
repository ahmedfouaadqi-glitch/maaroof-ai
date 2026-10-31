// Server-only Firecrawl helpers.
// Adds: 24h cache via analysis_cache, per-user/per-tool/global limits via app_settings.firecrawl_policy,
// usage logging to firecrawl_usage, and lower-cost defaults (limit=4, deep=false, onlyMainContent=true).

import { createHash } from "node:crypto";

const BASE = "https://api.firecrawl.dev/v2";
import {
  FETCH_TIMEOUT_MS, scrapeOrder, searchOrder, hasUsableScrapeEvidence,
  PublicReadFailure, classifyUnusableScrape, preferredReadFailure, isInstagramUrl, parseRetryAfterMs,
} from "./fetch-order";

export class FirecrawlError extends Error {
  status: number;
  operation: "search" | "scrape" | "map" | "crawl";
  body: string;
  retryAfterMs?: number;
  constructor(operation: "search" | "scrape" | "map" | "crawl", status: number, body: string, retryAfterMs?: number) {
    super(`Automated content retrieval failed (HTTP ${status}).`);
    this.name = "ContentReadError";
    this.status = status;
    this.operation = operation;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

export class FirecrawlLimitError extends Error {
  scope: "global_daily" | "global_monthly" | "per_user_daily" | "per_tool";
  constructor(scope: FirecrawlLimitError["scope"], _message: string) {
    super("The available reading capacity for this operation has been reached.");
    this.name = "ReadCapacityError";
    this.scope = scope;
  }
}

export function isFirecrawlError(error: unknown): error is FirecrawlError {
  return error instanceof FirecrawlError || (
    !!error && typeof error === "object" && "status" in error && "operation" in error
  );
}

function getKey(): string {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("A content-reading configuration is unavailable.");
  return k;
}

let _admin: any = null;
async function getAdmin() {
  if (_admin) return _admin;
  const { createClient } = await import("@supabase/supabase-js");
  _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _admin;
}

type FcPolicy = {
  global_daily: number;
  global_monthly: number;
  per_user_daily: number;
  per_tool: Record<string, number>;
  cache_ttl_hours: number;
};
const DEFAULT_POLICY: FcPolicy = {
  global_daily: 2000, global_monthly: 50000, per_user_daily: 100,
  per_tool: {}, cache_ttl_hours: 24,
};
let _policyCache: { p: FcPolicy; at: number } | null = null;
async function getPolicy(): Promise<FcPolicy> {
  if (_policyCache && Date.now() - _policyCache.at < 60_000) return _policyCache.p;
  try {
    const db = await getAdmin();
    const { data } = await db.from("app_settings").select("value").eq("key", "firecrawl_policy").maybeSingle();
    const p = { ...DEFAULT_POLICY, ...((data?.value as any) || {}) };
    _policyCache = { p, at: Date.now() };
    return p;
  } catch { return DEFAULT_POLICY; }
}

function hashKey(op: string, payload: any): string {
  return createHash("sha256").update(`${op}:${JSON.stringify(payload)}`).digest("hex").slice(0, 32);
}

async function readCache(op: string, hash: string, ttlHours: number): Promise<any | null> {
  try {
    const db = await getAdmin();
    const since = new Date(Date.now() - ttlHours * 3600_000).toISOString();
    const { data } = await db.from("firecrawl_cache")
      .select("payload, created_at")
      .eq("cache_key", `${op}:${hash}`)
      .gte("created_at", since)
      .maybeSingle();
    return (data as any)?.payload || null;
  } catch { return null; }
}
async function writeCache(op: string, hash: string, payload: any): Promise<void> {
  try {
    const db = await getAdmin();
    await db.from("firecrawl_cache").upsert({
      cache_key: `${op}:${hash}`,
      payload,
      created_at: new Date().toISOString(),
    }, { onConflict: "cache_key" });
  } catch {}
}

async function logUsage(row: {
  userId?: string | null; toolKey?: string | null; op: "search"|"scrape"|"map"|"crawl";
  units: number; queryHash: string; cacheHit: boolean; latencyMs?: number; status?: number;
}) {
  try {
    const db = await getAdmin();
    await db.from("firecrawl_usage").insert({
      user_id: row.userId || null,
      tool_key: row.toolKey || null,
      op: row.op,
      units: row.units,
      query_hash: row.queryHash,
      cache_hit: row.cacheHit,
      latency_ms: row.latencyMs ?? null,
      status: row.status ?? null,
    });
  } catch {}
}

async function checkLimits(userId: string | null | undefined, toolKey: string | null | undefined): Promise<void> {
  const policy = await getPolicy();
  const db = await getAdmin();
  const now = Date.now();
  const dayStart = new Date(now - 86400_000).toISOString();
  const monthStart = new Date(now - 30 * 86400_000).toISOString();

  // global day
  const { count: gDay } = await db.from("firecrawl_usage").select("id", { count: "exact", head: true })
    .eq("cache_hit", false).gte("created_at", dayStart);
  if ((gDay || 0) >= policy.global_daily) throw new FirecrawlLimitError("global_daily", "Daily reading capacity reached.");

  // global month
  const { count: gMo } = await db.from("firecrawl_usage").select("id", { count: "exact", head: true })
    .eq("cache_hit", false).gte("created_at", monthStart);
  if ((gMo || 0) >= policy.global_monthly) throw new FirecrawlLimitError("global_monthly", "Monthly reading capacity reached.");

  // per-user day
  if (userId) {
    const { count } = await db.from("firecrawl_usage").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("cache_hit", false).gte("created_at", dayStart);
    if ((count || 0) >= policy.per_user_daily) throw new FirecrawlLimitError("per_user_daily", "The daily reading allowance for this account has been reached.");
  }

  // per-tool month
  if (toolKey && policy.per_tool[toolKey]) {
    const cap = policy.per_tool[toolKey];
    const { count } = await db.from("firecrawl_usage").select("id", { count: "exact", head: true })
      .eq("tool_key", toolKey).eq("cache_hit", false).gte("created_at", monthStart);
    if ((count || 0) >= cap) throw new FirecrawlLimitError("per_tool", "The monthly reading allowance for this operation has been reached.");
  }
}

export type FcCtx = { userId?: string | null; toolKey?: string | null };

async function fcSearchRaw(query: string, opts: { limit?: number; lang?: string; location?: string } = {}, ctx: FcCtx = {}) {
  const limit = Math.min(opts.limit ?? 4, 10); // lowered default 6 -> 4
  const payload: any = { query, limit, lang: opts.lang, ...(opts.location ? { location: opts.location } : {}), scrapeOptions: { formats: ["markdown"], onlyMainContent: true } };
  const hash = hashKey("search", payload);
  const policy = await getPolicy();

  const cached = await readCache("search", hash, policy.cache_ttl_hours);
  if (cached) {
    await logUsage({ ...ctx, op: "search", units: 0, queryHash: hash, cacheHit: true });
    return cached;
  }
  await checkLimits(ctx.userId, ctx.toolKey);

  const t0 = Date.now();
  const res = await fetch(`${BASE}/search`, {
    method: "POST", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify(payload),
  });
  const latency = Date.now() - t0;
  if (!res.ok) {
    await logUsage({ ...ctx, op: "search", units: 0, queryHash: hash, cacheHit: false, latencyMs: latency, status: res.status });
    throw new FirecrawlError("search", res.status, await res.text().catch(() => ""));
  }
  const json = await res.json();
  await writeCache("search", hash, json);
  await logUsage({ ...ctx, op: "search", units: limit, queryHash: hash, cacheHit: false, latencyMs: latency, status: res.status });
  try {
    const { logFirecrawlSpend } = await import("./spend.server");
    await logFirecrawlSpend({ userId: ctx.userId || null, toolKey: ctx.toolKey || null, units: limit, latencyMs: latency, endpoint: "fc.search" });
  } catch {}
  return json;
}

async function fcScrapeRaw(url: string, opts: { deep?: boolean; screenshot?: boolean } = {}, ctx: FcCtx = {}) {
  const deep = !!opts.deep;
  const formats = deep ? ["markdown", "html", "links"] : ["markdown"];
  if (opts.screenshot) formats.push("screenshot@fullPage");
  const payload = { url, formats, onlyMainContent: true }; // force onlyMainContent always
  const hash = hashKey("scrape", payload);
  const policy = await getPolicy();

  const cached = await readCache("scrape", hash, policy.cache_ttl_hours);
  if (cached) {
    await logUsage({ ...ctx, op: "scrape", units: 0, queryHash: hash, cacheHit: true });
    return cached;
  }
  await checkLimits(ctx.userId, ctx.toolKey);

  const t0 = Date.now();
  const res = await fetch(`${BASE}/scrape`, {
    method: "POST", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify(payload),
  });
  const latency = Date.now() - t0;
  if (!res.ok) {
    await logUsage({ ...ctx, op: "scrape", units: 0, queryHash: hash, cacheHit: false, latencyMs: latency, status: res.status });
    throw new FirecrawlError("scrape", res.status, await res.text().catch(() => ""), parseRetryAfterMs(res.headers.get("retry-after")));
  }
  const json = await res.json();
  await writeCache("scrape", hash, json);
  const units = deep ? 5 : 1;
  await logUsage({ ...ctx, op: "scrape", units, queryHash: hash, cacheHit: false, latencyMs: latency, status: res.status });
  try {
    const { logFirecrawlSpend } = await import("./spend.server");
    await logFirecrawlSpend({ userId: ctx.userId || null, toolKey: ctx.toolKey || null, units, latencyMs: latency, endpoint: "fc.scrape" });
  } catch {}
  return json;
}


function available() {
  return { firecrawl: !!process.env.FIRECRAWL_API_KEY, apidirect: !!process.env.APIDIRECT_API_KEY };
}

function normalizedScrapeFailure(error: unknown, source: string, url: string): PublicReadFailure {
  if (error instanceof PublicReadFailure) return error;
  const e = error as any;
  const message = String(e?.message || error || "").toLowerCase();
  if (e?.scope || e?.name === "ReadCapacityError") {
    return new PublicReadFailure("reader_quota_reached", "reader", Number.isFinite(e?.status) ? e.status : undefined);
  }
  // An HTTP status on a provider-side error describes the reading route, not the target website.
  if (e?.operation && typeof e?.status === "number") {
    return new PublicReadFailure(
      e.status === 429 ? "reader_rate_limited" : "source_unavailable",
      "reader",
      e.status,
      typeof e.retryAfterMs === "number" ? e.retryAfterMs : undefined,
    );
  }
  if (/timeout|timed out|aborterror|aborted/.test(message)) {
    return new PublicReadFailure("timeout", source === "direct_http" ? "target" : "reader");
  }
  if (source === "direct_http" && /direct\s+429/.test(message)) {
    return new PublicReadFailure(isInstagramUrl(url) ? "instagram_rate_limited" : "target_rate_limited", "target", 429);
  }
  if (source === "direct_http" && /direct\s+(401|403)/.test(message)) {
    const status = Number(message.match(/direct\s+(401|403)/)?.[1]);
    return new PublicReadFailure(isInstagramUrl(url) ? "instagram_automated_access_denied" : "target_access_restricted", "target", status);
  }
  if (/429|rate.?limit/.test(message)) {
    return new PublicReadFailure("reader_rate_limited", "reader", 429);
  }
  return new PublicReadFailure("source_unavailable", source === "direct_http" ? "target" : "reader");
}

async function directHttp(url: string) {
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  // Reuse successful direct reads so the same public URL is not fetched repeatedly during quota incidents.
  const cacheKey = hashKey("direct_http_scrape", { url: u });
  const policy = await getPolicy();
  const cached = await readCache("direct_http_scrape", cacheKey, policy.cache_ttl_hours);
  if (cached && hasUsableScrapeEvidence(cached)) return cached;

  const r = await fetch(u, { headers: { "User-Agent": "MaaroofBot/1.0" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const retryAfterMs = parseRetryAfterMs(r.headers.get("retry-after"));
  if (!r.ok) {
    if (isInstagramUrl(u) && r.status === 429) throw new PublicReadFailure("instagram_rate_limited", "target", r.status, retryAfterMs);
    if (isInstagramUrl(u) && [401, 403].includes(r.status)) throw new PublicReadFailure("instagram_automated_access_denied", "target", r.status, retryAfterMs);
    if (r.status === 429) throw new PublicReadFailure("target_rate_limited", "target", r.status, retryAfterMs);
    if ([401, 403].includes(r.status)) throw new PublicReadFailure("target_access_restricted", "target", r.status, retryAfterMs);
    throw new PublicReadFailure("source_unavailable", "target", r.status, retryAfterMs);
  }
  const html = await r.text();
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const attr = (tag: string, name: string) => {
    const re = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(['\"])(.*?)\\1", "i");
    return (tag.match(re)?.[2] || "").trim();
  };
  const metaValue = (...keys: string[]) => {
    for (const key of keys) {
      const tag = tags.find((t) => [attr(t, "name"), attr(t, "property"), attr(t, "itemprop")].some((v) => v.toLowerCase() === key.toLowerCase()));
      const value = tag ? attr(tag, "content") : "";
      if (value) return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    }
    return "";
  };
  const pick = (re: RegExp) => (html.match(re)?.[1] || "").trim();
  const rawTitle = pick(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/<[^>]+>/g, "").trim();
  const title = metaValue("og:title", "twitter:title") || rawTitle;
  const description = metaValue("description", "og:description", "twitter:description");
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<h1[^>]*>/gi, "\n# ").replace(/<h([23])[^>]*>/gi, (_m, n) => "\n" + "#".repeat(+n) + " ")
    .replace(/<li[^>]*>/gi, "\n- ").replace(/<\/(p|div|h\d|li|section)>/gi, "\n\n").replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (body.length < 40 && !(title.length >= 3 && description.length >= 20)) {
    throw new PublicReadFailure("insufficient_public_content", "target", r.status, retryAfterMs);
  }
  const markdown = body.length >= 40 ? body : [title, description].filter(Boolean).join("\n\n");
  const result = { success: true, data: { markdown, html, metadata: { title, description, sourceURL: u, statusCode: r.status } } };
  if (!hasUsableScrapeEvidence(result)) {
    throw new PublicReadFailure(classifyUnusableScrape(result, u), "target", r.status, retryAfterMs);
  }
  await writeCache("direct_http_scrape", cacheKey, result);
  return result;
}

/** Scrape with fallback chain (see fetch-order.ts). Result carries `fetch_source`. */
export async function fcScrape(url: string, opts: { deep?: boolean; screenshot?: boolean; allowDirectHttp?: boolean } = {}, ctx: FcCtx = {}) {
  const failures: PublicReadFailure[] = [];
  for (const src of scrapeOrder(url, available())) {
    // Some callers handle user-supplied URLs. They may explicitly prohibit the worker direct-fetch fallback.
    if (src === "direct_http" && opts.allowDirectHttp === false) continue;
    try {
      let r: any;
      if (src === "firecrawl") r = await fcScrapeRaw(url, { deep: opts.deep, screenshot: opts.screenshot }, ctx);
      else if (src === "linkedin_direct") { const { adLinkedIn } = await import("./apidirect.server"); r = await adLinkedIn(url, FETCH_TIMEOUT_MS); }
      else r = await directHttp(url);
      if (!hasUsableScrapeEvidence(r)) {
        failures.push(new PublicReadFailure(classifyUnusableScrape(r, url), "target", Number((r?.data ?? r)?.metadata?.statusCode) || undefined));
        continue;
      }
      if (r && typeof r === "object") r.fetch_source = src;
      return r;
    } catch (e) {
      failures.push(normalizedScrapeFailure(e, src, url));
    }
  }
  throw preferredReadFailure(failures);
}

/** Search with fallback chain. Result carries `fetch_source`. */
export async function fcSearch(query: string, opts: { limit?: number; lang?: string; location?: string } = {}, ctx: FcCtx = {}) {
  let last: unknown = null;
  for (const src of searchOrder(available())) {
    try {
      let r: any;
      if (src === "firecrawl") r = await fcSearchRaw(query, opts, ctx);
      else { const { adSearch } = await import("./apidirect.server"); r = await adSearch(query, Math.min(opts.limit ?? 4, 10), FETCH_TIMEOUT_MS); }
      if (r && typeof r === "object") r.fetch_source = src;
      return r;
    } catch (e) { last = e; }
  }
  throw last || new Error("no_search_source");
}
