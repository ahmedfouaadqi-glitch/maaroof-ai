// MCI resolver — runs BEFORE an existing tool. It never changes tool logic;
// it only decides "reuse" vs "execute" and logs the decision. Fails open.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toolProfile, isFresh, requestFingerprint } from "./registry";

export type MciSettings = { enabled: boolean; tools: Record<string, boolean> };

export async function loadMciSettings(admin: SupabaseClient): Promise<MciSettings> {
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "mci").maybeSingle();
    const v: any = (data as any)?.value || {};
    return { enabled: v.enabled !== false, tools: v.tools || {} };
  } catch {
    return { enabled: true, tools: {} };
  }
}

export function mciActiveFor(s: MciSettings, toolKey: string): boolean {
  const p = toolProfile(toolKey);
  if (!s.enabled || !p) return false;
  return s.tools[toolKey] ?? p.mciEnabled;
}

export async function logMciDecision(admin: SupabaseClient, row: {
  userId: string; toolKey: string; decision: "reuse" | "execute" | "fallback";
  reusedRunId?: string | null; llmCalls?: number; llmSaved?: number;
  fcCalls?: number; fcSaved?: number; fallback?: boolean; meta?: any; intent?: string;
}) {
  try {
    await admin.from("mci_decisions").insert({
      user_id: row.userId, tool_key: row.toolKey, intent: row.intent || "DISCOVER_COMPETITORS", decision: row.decision,
      reused_run_id: row.reusedRunId || null, llm_calls: row.llmCalls || 0, llm_calls_saved: row.llmSaved || 0,
      firecrawl_calls: row.fcCalls || 0, firecrawl_calls_saved: row.fcSaved || 0, fallback: !!row.fallback, meta: row.meta || {},
    } as any);
  } catch {}
}

/** Find a reusable MKD run for the same user + brand + market + depth. */
export async function findReusableKnownRun(admin: SupabaseClient, userId: string, brand: string, market: string, depth: string) {
  const p = toolProfile("known")!;
  const since = new Date(Date.now() - p.reuseHours * 3600_000).toISOString();
  const fp = requestFingerprint([brand, market, depth]);
  const { data } = await admin.from("mkd_runs")
    .select("id, created_at, summary, brand, depth, scope")
    .eq("user_id", userId).eq("status", "done").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(20);
  const hit = (data || []).find((r: any) => r?.summary?.result && requestFingerprint([r.brand, r.summary?.result?.market === "World" ? "" : r.summary?.result?.market, r.depth]) === fp);
  if (!hit || !isFresh((hit as any).created_at, p.reuseHours)) return null;
  return hit as any;
}

/** Engine answer cache (24h). Key = engine + question fingerprint + market. */
export async function getEngineCache(admin: SupabaseClient, key: string, hours: number): Promise<string[] | null> {
  try {
    const { data } = await admin.from("engine_answer_cache").select("answer, created_at").eq("cache_key", key).maybeSingle();
    if (!data || !isFresh((data as any).created_at, hours)) return null;
    const a = (data as any).answer;
    return Array.isArray(a) ? a : null;
  } catch { return null; }
}

export async function setEngineCache(admin: SupabaseClient, key: string, engine: string, answer: string[]) {
  try {
    await admin.from("engine_answer_cache").upsert({ cache_key: key, engine, answer: answer as any, created_at: new Date().toISOString() } as any);
  } catch {}
}

// ---- Generic per-tool result reuse (additive). Stored in engine_answer_cache with a
// user-scoped key, so one user never sees another user's result. Always fails open.
async function sha(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export async function toolCacheKey(toolKey: string, userId: string, parts: unknown[]): Promise<string> {
  const fp = requestFingerprint(parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p ?? ""))));
  return `tool:${toolKey}:${userId}:${await sha(fp)}`;
}

/** Returns a previous result for the same user + same request, or null. Never throws. */
export async function mciReuse(admin: SupabaseClient, toolKey: string, userId: string, parts: unknown[], force?: boolean): Promise<{ key: string | null; hit: any | null; at?: string }> {
  try {
    const s = await loadMciSettings(admin);
    if (!mciActiveFor(s, toolKey)) return { key: null, hit: null };
    const key = await toolCacheKey(toolKey, userId, parts);
    if (force) return { key, hit: null };
    const p = toolProfile(toolKey)!;
    const { data } = await admin.from("engine_answer_cache").select("answer, created_at").eq("cache_key", key).maybeSingle();
    if (!data || !isFresh((data as any).created_at, p.reuseHours)) return { key, hit: null };
    await logMciDecision(admin, { userId, toolKey, decision: "reuse", llmSaved: 1, fcSaved: p.needsExternalData ? 1 : 0, intent: toolKey } as any);
    return { key, hit: (data as any).answer, at: (data as any).created_at };
  } catch {
    return { key: null, hit: null };
  }
}

export async function mciStore(admin: SupabaseClient, toolKey: string, userId: string, key: string | null, result: unknown) {
  if (!key) return;
  try {
    await admin.from("engine_answer_cache").upsert({ cache_key: key, engine: `tool:${toolKey}`, answer: result as any, created_at: new Date().toISOString() } as any);
    await logMciDecision(admin, { userId, toolKey, decision: "execute", llmCalls: 1, intent: toolKey } as any);
  } catch {}
}
