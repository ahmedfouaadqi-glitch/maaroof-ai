// System Health diagnostics for the admin console.
// Single server function returns a structured snapshot of every known check.
import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!data) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return next({ context: { supabaseAdmin } as any });
  });

// Static list of all tool routes that SHOULD record real cost.
const METERED_ENDPOINTS = [
  "analyze", "suggest", "research", "compare", "feasibility", "bizdev",
  "visibility", "geo-strategist", "geo-rewrite", "applied-ranking",
  "brand-authority", "brand-boost", "company-email", "social-analysis",
  "what-if", "competitor-monitor",
];

export type HealthSnapshot = {
  generatedAt: string;
  totals: {
    ledger_rows_30d: number;
    metered_rows_30d: number;
    unmetered_rows_30d: number;
    metered_pct: number;
    real_usd_30d: number;
    charged_usd_30d: number;
    margin_usd_30d: number;
  };
  negativeMargin: { tool_key: string; charged: number; real: number; margin: number; requests: number }[];
  unmeteredTools: { tool_key: string; rows: number; last_seen: string | null }[];
  toolsMissingInstrumentation: string[];
  unpriced402: { tool_key: string; count: number }[];
  firecrawlSpike: { day: string; units: number; avg7d: number; ratio: number } | null;
  profilesNoMetering: number;
  recentErrors: { action: string; count: number }[];
  maaroof: {
    runs_7d: number;
    done_7d: number;
    error_7d: number;
    total_usd_7d: number;
    avg_usd_per_run: number;
    avg_cost_alert: boolean;
    top_goals: { goal: string; usd: number; runs: number }[];
    recent: { id: string; user_id: string; goal: string; status: string; steps: number; usd: number; started_at: string }[];
  };
};

export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }): Promise<HealthSnapshot> => {
    const { supabaseAdmin } = context as any;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();

    // 1) Ledger snapshot (last 30d)
    const { data: ledger } = await supabaseAdmin
      .from("token_ledger")
      .select("tool_key, usd_cost, meta, created_at")
      .gte("created_at", since)
      .limit(50000);
    const rows = (ledger || []) as any[];

    let metered = 0, unmetered = 0, realUsd = 0, chargedUsd = 0;
    const perTool = new Map<string, { charged: number; real: number; requests: number; meteredCount: number; lastSeen: string | null }>();
    for (const r of rows) {
      const tk = r.tool_key || "unknown";
      const m = r.meta || {};
      const isMet = typeof m.real_usd_cost === "number" || typeof m.input_tokens === "number";
      const real = typeof m.real_usd_cost === "number"
        ? m.real_usd_cost
        : m.breakdown ? (Number(m.breakdown.ai) || 0) + (Number(m.breakdown.firecrawl) || 0) + (Number(m.breakdown.semrush) || 0) : 0;
      const charged = Number(r.usd_cost) || 0;
      chargedUsd += charged;
      if (isMet) { metered++; realUsd += real; } else { unmetered++; }
      const t = perTool.get(tk) || { charged: 0, real: 0, requests: 0, meteredCount: 0, lastSeen: null };
      t.charged += charged; t.real += real; t.requests++;
      if (isMet) t.meteredCount++;
      if (!t.lastSeen || r.created_at > t.lastSeen) t.lastSeen = r.created_at;
      perTool.set(tk, t);
    }

    const negativeMargin = Array.from(perTool.entries())
      .filter(([, t]) => t.meteredCount > 0 && t.real > t.charged)
      .map(([k, t]) => ({ tool_key: k, charged: t.charged, real: t.real, margin: t.charged - t.real, requests: t.requests }))
      .sort((a, b) => a.margin - b.margin);

    const unmeteredTools = Array.from(perTool.entries())
      .filter(([, t]) => t.meteredCount === 0 && t.requests > 0)
      .map(([k, t]) => ({ tool_key: k, rows: t.requests, last_seen: t.lastSeen }))
      .sort((a, b) => b.rows - a.rows);

    const seenKeys = new Set(Array.from(perTool.keys()));
    const toolsMissingInstrumentation = METERED_ENDPOINTS.filter((k) => {
      const t = perTool.get(k);
      return !t || t.meteredCount === 0;
    });

    // 2) unpriced 402s from activity_log
    const { data: acts } = await supabaseAdmin
      .from("activity_log")
      .select("action, metadata, created_at")
      .gte("created_at", since)
      .limit(10000);
    const unpricedMap = new Map<string, number>();
    const errorMap = new Map<string, number>();
    for (const a of (acts || []) as any[]) {
      const md = a.metadata || {};
      if (md.error === "unpriced" || md.reason === "unpriced") {
        const k = md.tool || a.action || "unknown";
        unpricedMap.set(k, (unpricedMap.get(k) || 0) + 1);
      }
      if (md.error && md.error !== "unpriced") {
        const k = String(a.action) + ":" + String(md.error).slice(0, 40);
        errorMap.set(k, (errorMap.get(k) || 0) + 1);
      }
    }
    const unpriced402 = Array.from(unpricedMap.entries())
      .map(([tool_key, count]) => ({ tool_key, count }))
      .sort((a, b) => b.count - a.count);
    const recentErrors = Array.from(errorMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 3) Firecrawl spike
    let firecrawlSpike: HealthSnapshot["firecrawlSpike"] = null;
    try {
      const { data: fc } = await supabaseAdmin
        .from("firecrawl_usage")
        .select("created_at, units")
        .gte("created_at", new Date(Date.now() - 8 * 86400000).toISOString())
        .limit(20000);
      const byDay = new Map<string, number>();
      for (const r of (fc || []) as any[]) {
        const d = String(r.created_at).slice(0, 10);
        byDay.set(d, (byDay.get(d) || 0) + (Number(r.units) || 0));
      }
      const days = Array.from(byDay.entries()).sort();
      if (days.length >= 2) {
        const today = days[days.length - 1];
        const prev = days.slice(0, -1);
        const avg = prev.reduce((s, [, n]) => s + n, 0) / Math.max(1, prev.length);
        const ratio = avg > 0 ? today[1] / avg : 0;
        if (ratio > 1.2) firecrawlSpike = { day: today[0], units: today[1], avg7d: Math.round(avg), ratio: Number(ratio.toFixed(2)) };
      }
    } catch {}

    // 4) Profiles with no metering configured
    const { count: profilesNoMetering } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .is("tokens_daily_limit", null)
      .is("tokens_monthly_limit", null)
      .eq("tokens_balance", 0);

    const total = metered + unmetered;

    // 5) Maaroof orchestrator stats (last 7d)
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: mruns } = await supabaseAdmin
      .from("maaroof_runs")
      .select("id, user_id, goal, status, steps_count, total_usd, started_at")
      .gte("started_at", since7)
      .order("started_at", { ascending: false })
      .limit(500);
    const mr = (mruns || []) as any[];
    const done = mr.filter((r) => r.status === "done").length;
    const errs = mr.filter((r) => r.status === "error").length;
    const sumUsd = mr.reduce((s, r) => s + (Number(r.total_usd) || 0), 0);
    const avg = mr.length ? sumUsd / mr.length : 0;
    const byGoal = new Map<string, { usd: number; runs: number }>();
    for (const r of mr) {
      const g = String(r.goal || "").slice(0, 120);
      const cur = byGoal.get(g) || { usd: 0, runs: 0 };
      cur.usd += Number(r.total_usd) || 0; cur.runs++;
      byGoal.set(g, cur);
    }
    const topGoals = Array.from(byGoal.entries())
      .map(([goal, v]) => ({ goal, usd: Number(v.usd.toFixed(4)), runs: v.runs }))
      .sort((a, b) => b.usd - a.usd).slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        ledger_rows_30d: total,
        metered_rows_30d: metered,
        unmetered_rows_30d: unmetered,
        metered_pct: total ? Math.round((metered / total) * 1000) / 10 : 0,
        real_usd_30d: Number(realUsd.toFixed(4)),
        charged_usd_30d: Number(chargedUsd.toFixed(4)),
        margin_usd_30d: Number((chargedUsd - realUsd).toFixed(4)),
      },
      negativeMargin,
      unmeteredTools,
      toolsMissingInstrumentation,
      unpriced402,
      firecrawlSpike,
      profilesNoMetering: Number(profilesNoMetering) || 0,
      recentErrors,
      maaroof: {
        runs_7d: mr.length,
        done_7d: done,
        error_7d: errs,
        total_usd_7d: Number(sumUsd.toFixed(4)),
        avg_usd_per_run: Number(avg.toFixed(4)),
        avg_cost_alert: avg > 0.5,
        top_goals: topGoals,
        recent: mr.slice(0, 20).map((r) => ({
          id: r.id, user_id: r.user_id, goal: String(r.goal || "").slice(0, 200),
          status: r.status, steps: Number(r.steps_count) || 0,
          usd: Number(r.total_usd) || 0, started_at: r.started_at,
        })),
      },
    };
  });
