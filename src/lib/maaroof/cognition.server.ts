// Part 5 — Cognitive Intelligence Engine (server helpers).
// Anonymized "Platform DNA" extraction + Evolution reports.
// Additive: nothing calls these unless the orchestrator/admin opts in.
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db as any;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db as any;
}

export type PlatformDnaKind =
  | "decision" | "reasoning" | "planning" | "execution"
  | "capability" | "learning" | "cost" | "future"
  | "policy" | "tool" | "mcp" | "optimization";

/** Strip anything remotely identifying before persisting a pattern. */
function anonymize(payload: Record<string, any>): Record<string, any> {
  const clone: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (/user|email|name|phone|token|ip|address|api|secret|key/i.test(k)) continue;
    if (typeof v === "string" && v.length > 400) {
      clone[k] = v.slice(0, 400);
    } else if (typeof v === "object" && v !== null) {
      clone[k] = anonymize(v as Record<string, any>);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}

/** Persist an anonymized DNA pattern. No-op on failure. */
export async function recordDna(opts: {
  kind: PlatformDnaKind;
  payload: Record<string, any>;
  weight?: number;
  sourceRunId?: string | null;
}): Promise<void> {
  try {
    await db().from("platform_dna").insert({
      kind: opts.kind,
      payload: anonymize(opts.payload || {}),
      weight: Math.max(0, Math.min(10, Number(opts.weight ?? 1))),
      source_run_id: opts.sourceRunId || null,
    });
  } catch {}
}

/** Summaries used by admin dashboards. Never leaks per-user info. */
export async function summarizeDna(kind?: PlatformDnaKind): Promise<Array<{ kind: string; count: number; last_at: string }>> {
  try {
    let q = db().from("platform_dna").select("kind, created_at");
    if (kind) q = q.eq("kind", kind);
    const { data } = await q.order("created_at", { ascending: false }).limit(500);
    const rows = ((data as any[]) || []) as Array<{ kind: string; created_at: string }>;
    const map = new Map<string, { count: number; last_at: string }>();
    for (const r of rows) {
      const cur = map.get(r.kind) || { count: 0, last_at: r.created_at };
      cur.count += 1;
      if (r.created_at > cur.last_at) cur.last_at = r.created_at;
      map.set(r.kind, cur);
    }
    return [...map.entries()].map(([k, v]) => ({ kind: k, ...v }));
  } catch {
    return [];
  }
}

/** Build (and persist) an Evolution Report over the given window. */
export async function buildEvolutionReport(period: "week" | "month" | "quarter"): Promise<{ id: string } | null> {
  const now = new Date();
  const start = new Date(now);
  if (period === "week") start.setDate(start.getDate() - 7);
  else if (period === "month") start.setMonth(start.getMonth() - 1);
  else start.setMonth(start.getMonth() - 3);

  try {
    const [dna, caps, runs] = await Promise.all([
      db().from("platform_dna").select("kind").gte("created_at", start.toISOString()),
      db().from("capability_scores_v").select("*"),
      db().from("maaroof_runs").select("status, total_usd, total_tokens").gte("started_at", start.toISOString()),
    ]);
    const dnaRows = ((dna.data as any[]) || []) as Array<{ kind: string }>;
    const runRows = ((runs.data as any[]) || []) as Array<{ status: string; total_usd: number | string | null; total_tokens: number | null }>;
    const runsCount = runRows.length;
    const succeeded = runRows.filter((r) => r.status === "succeeded" || r.status === "success").length;
    const totalUsd = runRows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totalTokens = runRows.reduce((s, r) => s + Number(r.total_tokens || 0), 0);
    const dnaByKind: Record<string, number> = {};
    for (const r of dnaRows) dnaByKind[r.kind] = (dnaByKind[r.kind] || 0) + 1;

    const payload = {
      period,
      window: { start: start.toISOString(), end: now.toISOString() },
      metrics: {
        runs: runsCount,
        success_rate: runsCount ? +(succeeded / runsCount).toFixed(3) : 0,
        total_usd: +totalUsd.toFixed(4),
        total_tokens: totalTokens,
      },
      dna: dnaByKind,
      capabilities: (caps.data as any[]) || [],
    };
    const { data } = await db()
      .from("maaroof_evolution_reports")
      .insert({ period, period_start: start.toISOString(), period_end: now.toISOString(), payload })
      .select("id")
      .single();
    return (data as any) || null;
  } catch {
    return null;
  }
}
