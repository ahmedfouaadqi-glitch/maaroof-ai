import { useEffect, useMemo, useState } from "react";
import { Loader2, DollarSign, Download, RefreshCw, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminL } from "./admin-i18n";
import { TOOL_CATALOG, toolLabel } from "@/lib/tool-catalog";
import { useI18n } from "@/lib/i18n";


type LedgerRow = {
  id: string;
  user_id: string | null;
  tool_key: string | null;
  tokens: number;
  usd_cost: number;
  meta: any;
  run_id: string | null;
  created_at: string;
};
type Profile = { id: string; email: string | null; username: string | null };

function realCostOf(row: LedgerRow): number {
  const m = row.meta || {};
  if (typeof m.real_usd_cost === "number") return m.real_usd_cost;
  const b = m.breakdown;
  if (b) return (Number(b.ai) || 0) + (Number(b.firecrawl) || 0) + (Number(b.semrush) || 0);
  return 0;
}
function tokensOf(row: LedgerRow): number {
  const m = row.meta || {};
  const t = (Number(m.input_tokens) || 0) + (Number(m.output_tokens) || 0);
  return t > 0 ? t : Number(row.tokens) || 0;
}
const fmt = (n: number, d = 4) => `$${(Number(n) || 0).toFixed(d)}`;

export function AdminFinanceTab() {
  const { lang } = useI18n();
  const L = useAdminL({
    title: { ar: "المالية الموحّدة (مُحصَّل × حقيقي)", en: "Unified Finance (Charged × Real)", ku: "دارایی یەکگرتوو" },
    today: { ar: "اليوم", en: "Today", ku: "ئەمڕۆ" },
    range: { ar: "المدى", en: "Range", ku: "ماوە" },
    charged: { ar: "مُحصَّل", en: "Charged", ku: "وەرگیراو" },
    real: { ar: "حقيقي", en: "Real", ku: "ڕاستی" },
    margin: { ar: "الهامش", en: "Margin", ku: "هامش" },
    requests: { ar: "الطلبات", en: "Requests", ku: "داواکاری" },
    avgReal: { ar: "متوسط حقيقي/طلب", en: "Avg real / req", ku: "ناوەند" },
    perToken: { ar: "حقيقي / 1k توكن", en: "Real / 1k tok", ku: "ڕاستی / 1k" },
    byTool: { ar: "حسب الأداة", en: "By tool", ku: "بەپێی ئامراز" },
    byUser: { ar: "حسب المستخدم", en: "By user", ku: "بەپێی بەکارهێنەر" },
    byProvider: { ar: "حسب المزود/النموذج", en: "Provider / model", ku: "دابینکەر" },
    tool: { ar: "الأداة", en: "Tool", ku: "ئامراز" },
    user: { ar: "المستخدم", en: "User", ku: "بەکارهێنەر" },
    provider: { ar: "المزود", en: "Provider", ku: "دابینکەر" },
    model: { ar: "النموذج", en: "Model", ku: "مۆدێل" },
    tokens: { ar: "توكنات", en: "Tokens", ku: "تۆکن" },
    reqs: { ar: "#", en: "#", ku: "#" },
    recent: { ar: "آخر العمليات", en: "Recent runs", ku: "دوایی" },
    when: { ar: "الوقت", en: "Time", ku: "کات" },
    fc: { ar: "Firecrawl", en: "Firecrawl", ku: "Firecrawl" },
    inOut: { ar: "in/out", en: "in/out", ku: "in/out" },
    run: { ar: "Run", en: "Run", ku: "Run" },
    reload: { ar: "تحديث", en: "Reload", ku: "نوێ" },
    csv: { ar: "تصدير CSV", en: "Export CSV", ku: "CSV" },
    search: { ar: "بحث", en: "Search", ku: "گەڕان" },
    allTools: { ar: "كل الأدوات", en: "All tools", ku: "هەموو" },
    allUsers: { ar: "كل المستخدمين", en: "All users", ku: "هەموو" },
    none: { ar: "لا توجد بيانات.", en: "No data.", ku: "هیچ." },
  });

  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("token_ledger").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      supabase.from("profiles").select("id,email,username").limit(1000),
    ]);
    setRows((r || []) as any);
    setProfiles(Object.fromEntries(((p || []) as Profile[]).map((x) => [x.id, x])));
    setLoading(false);
  };
  useEffect(() => { load(); }, [days]);

  const userLabel = (uid: string | null) => {
    if (!uid) return "—";
    const p = profiles[uid];
    return p?.email || p?.username || uid.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (toolFilter && r.tool_key !== toolFilter) return false;
      if (userFilter && r.user_id !== userFilter) return false;
      if (s) {
        const hay = `${userLabel(r.user_id)} ${r.tool_key || ""} ${r.meta?.provider || ""} ${r.meta?.model || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, q, toolFilter, userFilter, profiles]);

  const stats = useMemo(() => {
    const now = Date.now(); const dayStart = now - 86400_000;
    let dC = 0, dR = 0, dN = 0;
    let mC = 0, mR = 0, mN = 0, mTok = 0;
    const byTool: Record<string, { charged: number; real: number; req: number; tokens: number; latSum: number; latN: number }> = {};
    const byUser: Record<string, { charged: number; real: number; req: number; tokens: number }> = {};
    const byProv: Record<string, { charged: number; real: number; req: number }> = {};
    for (const r of filtered) {
      const t = new Date(r.created_at).getTime();
      const c = Number(r.usd_cost) || 0;
      const real = realCostOf(r);
      const tk = tokensOf(r);
      mC += c; mR += real; mN++; mTok += tk;
      if (t >= dayStart) { dC += c; dR += real; dN++; }
      const tool = r.tool_key || "—";
      byTool[tool] = byTool[tool] || { charged: 0, real: 0, req: 0, tokens: 0, latSum: 0, latN: 0 };
      byTool[tool].charged += c; byTool[tool].real += real; byTool[tool].req++; byTool[tool].tokens += tk;
      const lat = r.meta?.latency_ms; if (typeof lat === "number") { byTool[tool].latSum += lat; byTool[tool].latN++; }
      const uid = r.user_id || "—";
      byUser[uid] = byUser[uid] || { charged: 0, real: 0, req: 0, tokens: 0 };
      byUser[uid].charged += c; byUser[uid].real += real; byUser[uid].req++; byUser[uid].tokens += tk;
      const prov = `${r.meta?.provider || "unknown"}${r.meta?.model ? ` · ${r.meta.model}` : ""}`;
      byProv[prov] = byProv[prov] || { charged: 0, real: 0, req: 0 };
      byProv[prov].charged += c; byProv[prov].real += real; byProv[prov].req++;
    }
    const sort = <T extends { real: number }>(m: Record<string, T>) => Object.entries(m).sort((a, b) => b[1].real - a[1].real);
    return {
      dC, dR, dN, mC, mR, mN, mTok,
      avgReal: mN ? mR / mN : 0,
      perTokReal: mTok ? (mR / mTok) * 1000 : 0,
      tools: sort(byTool).slice(0, 30),
      users: sort(byUser).slice(0, 30),
      provs: sort(byProv),
    };
  }, [filtered]);

  const csv = () => {
    const header = "time,user,tool,provider,model,input_tokens,output_tokens,total_tokens,firecrawl_units,charged_usd,real_usd,margin_usd,real_per_1k_tok,latency_ms,run_id";
    const lines = filtered.map((r) => {
      const c = Number(r.usd_cost) || 0;
      const real = realCostOf(r);
      const tk = tokensOf(r);
      const per1k = tk ? (real / tk) * 1000 : 0;
      return [
        r.created_at, userLabel(r.user_id), r.tool_key || "",
        r.meta?.provider || "", r.meta?.model || "",
        r.meta?.input_tokens ?? "", r.meta?.output_tokens ?? "", tk,
        r.meta?.firecrawl_units ?? "",
        c.toFixed(6), real.toFixed(6), (c - real).toFixed(6), per1k.toFixed(6),
        r.meta?.latency_ms ?? "", r.run_id || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "finance-ledger.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const marginColor = (v: number) => v > 0 ? "text-emerald-500" : v < 0 ? "text-red-500" : "text-muted-foreground";
  const pct = (charged: number, real: number) => charged > 0 ? `${((charged - real) / charged * 100).toFixed(0)}%` : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <DollarSign className="size-5 text-primary" /> {L.title}
        </h2>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><RefreshCw className="size-3.5" /> {L.reload}</button>
          <button onClick={csv} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><Download className="size-3.5" /> {L.csv}</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DualStat label={L.today} charged={stats.dC} real={stats.dR} sub={`${stats.dN} ${L.requests}`} L={L} marginColor={marginColor} />
        <DualStat label={`${days}d`} charged={stats.mC} real={stats.mR} sub={`${stats.mN} ${L.requests}`} L={L} marginColor={marginColor} />
        <SingleStat label={L.avgReal} value={fmt(stats.avgReal, 5)} />
        <SingleStat label={L.perToken} value={fmt(stats.perTokReal, 5)} sub={`${stats.mTok.toLocaleString()} tok`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search}
            className="rounded-full border border-border bg-card/60 py-2 pr-9 pl-3 text-sm w-64" />
        </div>
        <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} className="rounded-full border border-border bg-card/60 px-3 py-2 text-sm">
          <option value="">{L.allTools}</option>
          {TOOL_CATALOG.map((t) => <option key={t.key} value={t.key}>{toolLabel(t.key as any, lang as any)}</option>)}
        </select>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="rounded-full border border-border bg-card/60 px-3 py-2 text-sm">
          <option value="">{L.allUsers}</option>
          {Object.values(profiles).slice(0, 200).map((p) => <option key={p.id} value={p.id}>{p.email || p.username || p.id.slice(0, 8)}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-full border border-border bg-card/60 px-3 py-2 text-sm">
          <option value={7}>7d</option><option value={30}>30d</option><option value={90}>90d</option>
        </select>
      </div>

      {/* By tool / By user */}
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card/60 p-4 overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">{L.byTool}</h3>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="px-1 py-1 text-start">{L.tool}</th>
              <th className="px-1 py-1 text-end">{L.reqs}</th>
              <th className="px-1 py-1 text-end">{L.tokens}</th>
              <th className="px-1 py-1 text-end text-primary">{L.charged}</th>
              <th className="px-1 py-1 text-end text-amber-500">{L.real}</th>
              <th className="px-1 py-1 text-end">{L.margin}</th>
              <th className="px-1 py-1 text-end">ms</th>
            </tr></thead>
            <tbody>{stats.tools.map(([k, v]) => {
              const m = v.charged - v.real;
              return (
                <tr key={k} className="border-t border-border/40">
                  <td className="px-1 py-1.5">{toolLabel(k as any, lang as any)}</td>
                  <td className="px-1 py-1.5 text-end font-mono">{v.req}</td>
                  <td className="px-1 py-1.5 text-end font-mono">{v.tokens.toLocaleString()}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-primary">{fmt(v.charged)}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-amber-500">{fmt(v.real)}</td>
                  <td className={`px-1 py-1.5 text-end font-mono ${marginColor(m)}`}>{fmt(m)} <span className="opacity-60">({pct(v.charged, v.real)})</span></td>
                  <td className="px-1 py-1.5 text-end font-mono text-muted-foreground">{v.latN ? Math.round(v.latSum / v.latN) : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </section>
        <section className="rounded-xl border border-border bg-card/60 p-4 overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">{L.byUser}</h3>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="px-1 py-1 text-start">{L.user}</th>
              <th className="px-1 py-1 text-end">{L.reqs}</th>
              <th className="px-1 py-1 text-end">{L.tokens}</th>
              <th className="px-1 py-1 text-end text-primary">{L.charged}</th>
              <th className="px-1 py-1 text-end text-amber-500">{L.real}</th>
              <th className="px-1 py-1 text-end">{L.margin}</th>
            </tr></thead>
            <tbody>{stats.users.map(([uid, v]) => {
              const m = v.charged - v.real;
              return (
                <tr key={uid} className="border-t border-border/40">
                  <td className="px-1 py-1.5 truncate max-w-[180px]">{userLabel(uid)}</td>
                  <td className="px-1 py-1.5 text-end font-mono">{v.req}</td>
                  <td className="px-1 py-1.5 text-end font-mono">{v.tokens.toLocaleString()}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-primary">{fmt(v.charged)}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-amber-500">{fmt(v.real)}</td>
                  <td className={`px-1 py-1.5 text-end font-mono ${marginColor(m)}`}>{fmt(m)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </section>
      </div>

      {/* By provider/model */}
      <section className="rounded-xl border border-border bg-card/60 p-4 overflow-x-auto">
        <h3 className="mb-2 text-sm font-semibold">{L.byProvider}</h3>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground"><tr>
            <th className="px-1 py-1 text-start">{L.provider}</th>
            <th className="px-1 py-1 text-end">{L.reqs}</th>
            <th className="px-1 py-1 text-end text-primary">{L.charged}</th>
            <th className="px-1 py-1 text-end text-amber-500">{L.real}</th>
            <th className="px-1 py-1 text-end">{L.margin}</th>
          </tr></thead>
          <tbody>{stats.provs.map(([k, v]) => {
            const m = v.charged - v.real;
            return (
              <tr key={k} className="border-t border-border/40">
                <td className="px-1 py-1.5 font-mono text-[11px]">{k}</td>
                <td className="px-1 py-1.5 text-end font-mono">{v.req}</td>
                <td className="px-1 py-1.5 text-end font-mono text-primary">{fmt(v.charged)}</td>
                <td className="px-1 py-1.5 text-end font-mono text-amber-500">{fmt(v.real)}</td>
                <td className={`px-1 py-1.5 text-end font-mono ${marginColor(m)}`}>{fmt(m)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>

      {/* Recent runs unified */}
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
              <th className="px-1 py-1 text-end">{L.inOut}</th>
              <th className="px-1 py-1 text-end">{L.tokens}</th>
              <th className="px-1 py-1 text-end">{L.fc}</th>
              <th className="px-1 py-1 text-end text-primary">{L.charged}</th>
              <th className="px-1 py-1 text-end text-amber-500">{L.real}</th>
              <th className="px-1 py-1 text-end">{L.margin}</th>
              <th className="px-1 py-1 text-end">{L.perToken}</th>
              <th className="px-1 py-1 text-end">ms</th>
              <th className="px-1 py-1 text-start">{L.run}</th>
            </tr></thead>
            <tbody>{filtered.slice(0, 200).map((r) => {
              const c = Number(r.usd_cost) || 0;
              const real = realCostOf(r);
              const tk = tokensOf(r);
              const m = c - real;
              const per1k = tk ? (real / tk) * 1000 : 0;
              return (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-1 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-1 py-1.5 truncate max-w-[140px]">{userLabel(r.user_id)}</td>
                  <td className="px-1 py-1.5">{toolLabel((r.tool_key || "") as any, lang as any) || "—"}</td>
                  <td className="px-1 py-1.5">{r.meta?.provider || "—"}</td>
                  <td className="px-1 py-1.5 text-[10px] font-mono">{r.meta?.model || "—"}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-[10px]">{(r.meta?.input_tokens ?? "—")}/{(r.meta?.output_tokens ?? "—")}</td>
                  <td className="px-1 py-1.5 text-end font-mono">{tk.toLocaleString()}</td>
                  <td className="px-1 py-1.5 text-end font-mono">{r.meta?.firecrawl_units ?? ""}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-primary">{fmt(c, 5)}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-amber-500">{fmt(real, 5)}</td>
                  <td className={`px-1 py-1.5 text-end font-mono ${marginColor(m)}`}>{fmt(m, 5)}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-muted-foreground">{fmt(per1k, 5)}</td>
                  <td className="px-1 py-1.5 text-end font-mono text-muted-foreground">{r.meta?.latency_ms ?? "—"}</td>
                  <td className="px-1 py-1.5 text-[10px] text-muted-foreground">{r.run_id?.slice(0, 8) || "—"}</td>
                </tr>
              );
            })}
              {filtered.length === 0 && <tr><td colSpan={14} className="py-4 text-center text-muted-foreground">{L.none}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DualStat({ label, charged, real, sub, L, marginColor }: { label: string; charged: number; real: number; sub?: string; L: any; marginColor: (v: number) => string }) {
  const m = charged - real;
  const pct = charged > 0 ? `${((m / charged) * 100).toFixed(0)}%` : "—";
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[10px] text-muted-foreground">{L.charged}</div>
          <div className="font-display text-xl font-bold text-primary">{fmt(charged)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">{L.real}</div>
          <div className="font-display text-xl font-bold text-amber-500">{fmt(real)}</div>
        </div>
      </div>
      <div className={`mt-1 text-xs font-semibold ${marginColor(m)}`}>{L.margin}: {fmt(m)} ({pct})</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SingleStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-gradient">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
