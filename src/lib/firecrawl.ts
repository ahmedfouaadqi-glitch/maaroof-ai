// Server-only Firecrawl helpers.
// Adds: 24h cache via analysis_cache, per-user/per-tool/global limits via app_settings.firecrawl_policy,
// usage logging to firecrawl_usage, and lower-cost defaults (limit=4, deep=false, onlyMainContent=true).

import { createHash } from "node:crypto";

const BASE = "https://api.firecrawl.dev/v2";

export class FirecrawlError extends Error {
  status: number;
  operation: "search" | "scrape" | "map" | "crawl";
  body: string;
  constructor(operation: "search" | "scrape" | "map" | "crawl", status: number, body: string) {
    super(`Firecrawl ${operation} failed: ${status}`);
    this.name = "FirecrawlError";
    this.status = status;
    this.operation = operation;
    this.body = body;
  }
}

export class FirecrawlLimitError extends Error {
  scope: "global_daily" | "global_monthly" | "per_user_daily" | "per_tool";
  constructor(scope: FirecrawlLimitError["scope"], message: string) {
    super(message);
    this.name = "FirecrawlLimitError";
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
  if (!k) throw new Error("FIRECRAWL_API_KEY is not configured");
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
  if ((gDay || 0) >= policy.global_daily) throw new FirecrawlLimitError("global_daily", "Firecrawl global daily limit reached.");

  // global month
  const { count: gMo } = await db.from("firecrawl_usage").select("id", { count: "exact", head: true })
    .eq("cache_hit", false).gte("created_at", monthStart);
  if ((gMo || 0) >= policy.global_monthly) throw new FirecrawlLimitError("global_monthly", "Firecrawl global monthly limit reached.");

  // per-user day
  if (userId) {
    const { count } = await db.from("firecrawl_usage").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("cache_hit", false).gte("created_at", dayStart);
    if ((count || 0) >= policy.per_user_daily) throw new FirecrawlLimitError("per_user_daily", "Your Firecrawl daily quota is reached. Try again tomorrow.");
  }

  // per-tool month
  if (toolKey && policy.per_tool[toolKey]) {
    const cap = policy.per_tool[toolKey];
    const { count } = await db.from("firecrawl_usage").select("id", { count: "exact", head: true })
      .eq("tool_key", toolKey).eq("cache_hit", false).gte("created_at", monthStart);
    if ((count || 0) >= cap) throw new FirecrawlLimitError("per_tool", `Monthly Firecrawl quota for ${toolKey} reached.`);
  }
}

export type FcCtx = { userId?: string | null; toolKey?: string | null };

export async function fcSearch(query: string, opts: { limit?: number; lang?: string } = {}, ctx: FcCtx = {}) {
  const limit = Math.min(opts.limit ?? 4, 10); // lowered default 6 -> 4
  const payload = { query, limit, lang: opts.lang, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } };
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
    method: "POST",
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

export async function fcScrape(url: string, opts: { deep?: boolean } = {}, ctx: FcCtx = {}) {
  const deep = !!opts.deep;
  const formats = deep ? ["markdown", "html", "links"] : ["markdown"];
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
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify(payload),
  });
  const latency = Date.now() - t0;
  if (!res.ok) {
    await logUsage({ ...ctx, op: "scrape", units: 0, queryHash: hash, cacheHit: false, latencyMs: latency, status: res.status });
    throw new FirecrawlError("scrape", res.status, await res.text().catch(() => ""));
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
