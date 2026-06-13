import { useEffect, useMemo, useState } from "react";
import { Loader2, DollarSign, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminL } from "./admin-i18n";

type LedgerRow = {
  id: string;
  user_id: string | null;
  tool_key: string | null;
  tokens: number;
  usd_cost: number;
  meta: any;
  created_at: string;
};

export function ProviderCostTab() {
  const L = useAdminL({
    title: { ar: "تكلفة المزوّدين (USD حقيقي)", en: "Provider cost (real USD)", ku: "تێچووی دابینکەرەکان" },
    today: { ar: "اليوم", en: "Today", ku: "ئەمڕۆ" },
    month: { ar: "30 يوم", en: "30 days", ku: "30 ڕۆژ" },
    totalUsd: { ar: "إجمالي USD", en: "Total USD", ku: "کۆی USD" },
    requests: { ar: "الطلبات", en: "Requests", ku: "داواکارییەکان" },
    avgUsd: { ar: "متوسط/طلب", en: "Avg / req", ku: "ناوەند" },
    byUser: { ar: "حسب المستخدم", en: "By user", ku: "بەپێی بەکارهێنەر" },
    byTool: { ar: "حسب الأداة", en: "By tool", ku: "بەپێی ئامراز" },
    byProvider: { ar: "حسب المزود", en: "By provider", ku: "بەپێی دابینکەر" },
    user: { ar: "المستخدم", en: "User", ku: "بەکارهێنەر" },
    tool: { ar: "الأداة", en: "Tool", ku: "ئامراز" },
    provider: { ar: "المزود", en: "Provider", ku: "دابینکەر" },
    reqs: { ar: "#طلبات", en: "Reqs", ku: "#" },
    tokens: { ar: "توكنات", en: "Tokens", ku: "تۆکن" },
    fcUnits: { ar: "Firecrawl", en: "Firecrawl", ku: "Firecrawl" },
    usd: { ar: "USD", en: "USD", ku: "USD" },
    recent: { ar: "آخر العمليات", en: "Recent", ku: "دوایی" },
    when: { ar: "الوقت", en: "Time", ku: "کات" },
    model: { ar: "النموذج", en: "Model", ku: "مۆدێل" },
    reload: { ar: "تحديث", en: "Reload", ku: "نوێ" },
    csv: { ar: "تصدير CSV", en: "Export CSV", ku: "CSV" },
    none: { ar: "لا توجد بيانات.", en: "No data.", ku: "هیچ." },
  });
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("token_ledger").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      supabase.from("profiles").select("id,email").limit(500),
    ]);
    setRows((r || []) as any);
    setProfiles(Object.fromEntries(((p || []) as any[]).map((x) => [x.id, x.email || x.id.slice(0, 8)])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const now = Date.now(); const dayStart = now - 86400_000;
    let dUsd = 0, dReq = 0, mUsd = 0, mReq = 0;
    const byUser: Record<string, { usd: number; req: number; tokens: number }> = {};
    const byTool: Record<string, { usd: number; req: number; tokens: number; latSum: number; latN: number }> = {};
    const byProv: Record<string, { usd: number; req: number }> = {};
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const usd = Number(r.usd_cost) || 0;
      const tk = Number(r.tokens) || 0;
      mUsd += usd; mReq++;
      if (t >= dayStart) { dUsd += usd; dReq++; }
      const uid = r.user_id || "—";
      byUser[uid] = byUser[uid] || { usd: 0, req: 0, tokens: 0 };
      byUser[uid].usd += usd; byUser[uid].req++; byUser[uid].tokens += tk;
      const tool = r.tool_key || "—";
      byTool[tool] = byTool[tool] || { usd: 0, req: 0, tokens: 0, latSum: 0, latN: 0 };
      byTool[tool].usd += usd; byTool[tool].req++; byTool[tool].tokens += tk;
      const lat = r.meta?.latency_ms; if (typeof lat === "number") { byTool[tool].latSum += lat; byTool[tool].latN++; }
      const prov = r.meta?.provider || "unknown";
      byProv[prov] = byProv[prov] || { usd: 0, req: 0 };
      byProv[prov].usd += usd; byProv[prov].req++;
    }
    const sortUsd = <T extends { usd: number }>(m: Record<string, T>) =>
      Object.entries(m).sort((a, b) => b[1].usd - a[1].usd);
    return {
      dUsd, dReq, mUsd, mReq,
      avg: mReq ? mUsd / mReq : 0,
      users: sortUsd(byUser).slice(0, 20),
      tools: sortUsd(byTool).slice(0, 20),
      provs: sortUsd(byProv),
    };
  }, [rows]);

  const csv = () => {
    const header = "time,user,tool,provider,model,input_tokens,output_tokens,firecrawl_units,tokens,usd,latency_ms";
    const lines = rows.map((r) => [
      r.created_at, profiles[r.user_id || ""] || r.user_id || "", r.tool_key || "",
      r.meta?.provider || "", r.meta?.model || "",
      r.meta?.input_tokens ?? "", r.meta?.output_tokens ?? "",
      r.meta?.firecrawl_units ?? "", r.tokens, r.usd_cost, r.meta?.latency_ms ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "provider-costs.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><DollarSign className="size-5 text-primary" /> {L.title}</h2>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><RefreshCw className="size-3.5" /> {L.reload}</button>
          <button onClick={csv} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><Download className="size-3.5" /> {L.csv}</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Stat label={`${L.today} · ${L.totalUsd}`} v={`$${stats.dUsd.toFixed(4)}`} sub={`${stats.dReq} ${L.requests}`} />
        <Stat label={`${L.month} · ${L.totalUsd}`} v={`$${stats.mUsd.toFixed(4)}`} sub={`${stats.mReq} ${L.requests}`} />
        <Stat label={L.avgUsd} v={`$${stats.avg.toFixed(5)}`} />
        <Stat label={L.byProvider} v={stats.provs.map(([p, v]) => `${p}: $${v.usd.toFixed(3)}`).join(" · ") || "—"} small />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card/60 p-4">
          <h3 className="mb-2 text-sm font-semibold">{L.byTool}</h3>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="px-1 py-1 text-start">{L.tool}</th>
              <th className="px-1 py-1 text-end">{L.reqs}</th>
              <th className="px-1 py-1 text-end">{L.tokens}</th>
              <th className="px-1 py-1 text-end">{L.usd}</th>
              <th className="px-1 py-1 text-end">ms</th>
            </tr></thead>
            <tbody>{stats.tools.map(([k, v]) => (
              <tr key={k} className="border-t border-border/40">
                <td className="px-1 py-1.5">{k}</td>
                <td className="px-1 py-1.5 text-end font-mono">{v.req}</td>
                <td className="px-1 py-1.5 text-end font-mono">{v.tokens}</td>
                <td className="px-1 py-1.5 text-end font-mono text-primary">${v.usd.toFixed(4)}</td>
                <td className="px-1 py-1.5 text-end font-mono text-muted-foreground">{v.latN ? Math.round(v.latSum / v.latN) : "—"}</td>
              </tr>))}</tbody>
          </table>
        </section>
        <section className="rounded-xl border border-border bg-card/60 p-4">
          <h3 className="mb-2 text-sm font-semibold">{L.byUser}</h3>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="px-1 py-1 text-start">{L.user}</th>
              <th className="px-1 py-1 text-end">{L.reqs}</th>
              <th className="px-1 py-1 text-end">{L.tokens}</th>
              <th className="px-1 py-1 text-end">{L.usd}</th>
            </tr></thead>
            <tbody>{stats.users.map(([uid, v]) => (
              <tr key={uid} className="border-t border-border/40">
                <td className="px-1 py-1.5 truncate max-w-[200px]">{profiles[uid] || uid.slice(0, 8)}</td>
                <td className="px-1 py-1.5 text-end font-mono">{v.req}</td>
                <td className="px-1 py-1.5 text-end font-mono">{v.tokens}</td>
                <td className="px-1 py-1.5 text-end font-mono text-primary">${v.usd.toFixed(4)}</td>
              </tr>))}</tbody>
          </table>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-2 text-sm font-semibold">{L.recent}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="px-1 py-1 text-start">{L.when}</th>
              <th className="px-1 py-1 text-start">{L.user}</th>
              <th className="px-1 py-1 text-start">{L.tool}</th>
              <th className="px-1 py-1 text-start">{L.provider}</th>
              <th className="px-1 py-1 text-start">{L.model}</th>
              <th className="px-1 py-1 text-end">{L.tokens}</th>
              <th className="px-1 py-1 text-end">{L.fcUnits}</th>
              <th className="px-1 py-1 text-end">{L.usd}</th>
            </tr></thead>
            <tbody>{rows.slice(0, 100).map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-1 py-1.5 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-1 py-1.5 truncate max-w-[140px]">{profiles[r.user_id || ""] || r.user_id?.slice(0, 8) || "—"}</td>
                <td className="px-1 py-1.5">{r.tool_key || "—"}</td>
                <td className="px-1 py-1.5">{r.meta?.provider || "—"}</td>
                <td className="px-1 py-1.5 text-[10px] font-mono">{r.meta?.model || "—"}</td>
                <td className="px-1 py-1.5 text-end font-mono">{r.tokens}</td>
                <td className="px-1 py-1.5 text-end font-mono">{r.meta?.firecrawl_units ?? ""}</td>
                <td className="px-1 py-1.5 text-end font-mono text-primary">${Number(r.usd_cost).toFixed(5)}</td>
              </tr>))}
              {rows.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-muted-foreground">{L.none}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, v, sub, small }: { label: string; v: string; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display ${small ? "text-sm" : "text-2xl"} font-bold text-gradient`}>{v}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
