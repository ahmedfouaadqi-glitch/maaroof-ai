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
  fcCalls?: number; fcSaved?: number; fallback?: boolean; meta?: any;
}) {
  try {
    await admin.from("mci_decisions").insert({
      user_id: row.userId, tool_key: row.toolKey, intent: "DISCOVER_COMPETITORS", decision: row.decision,
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
