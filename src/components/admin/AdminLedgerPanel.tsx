import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Download, Activity } from "lucide-react";
import { TOOL_CATALOG, toolLabel } from "@/lib/tool-catalog";
import { CostBadge, formatUsd } from "@/components/CostBadge";
import { useI18n } from "@/lib/i18n";
import { exportToCSV } from "@/lib/exports";

type LedgerRow = { id: string; user_id: string; tool_key: string; tokens: number; usd_cost: number; created_at: string; meta: any; run_id: string | null };
type Profile = { id: string; email: string | null; full_name: string | null; username: string | null };

const T = {
  ar: { title: "سجل التوكن المباشر", search: "بحث", user: "المستخدم", tool: "الأداة", tokens: "التوكن", usd: "التكلفة", time: "الوقت", run: "Run ID", noResults: "لا توجد سجلات", export: "تصدير CSV", today: "اليوم", month: "الشهر", total: "الإجمالي", topTools: "أكثر الأدوات استهلاكاً", topUsers: "أعلى مستخدمين كلفة", allTools: "كل الأدوات", allUsers: "كل المستخدمين" },
  en: { title: "Live token ledger", search: "Search", user: "User", tool: "Tool", tokens: "Tokens", usd: "Cost", time: "Time", run: "Run ID", noResults: "No records", export: "Export CSV", today: "Today", month: "Month", total: "Total", topTools: "Top tools by spend", topUsers: "Top users by spend", allTools: "All tools", allUsers: "All users" },
  ku: { title: "ڕیکۆردی تۆکنی ڕاستەوخۆ", search: "گەڕان", user: "بەکارهێنەر", tool: "ئامراز", tokens: "تۆکن", usd: "نرخ", time: "کات", run: "Run ID", noResults: "هیچ نییە", export: "ناردنە دەرەوە", today: "ئەمڕۆ", month: "مانگ", total: "کۆ", topTools: "ئامرازە گرانەکان", topUsers: "بەکارهێنەرە گرانەکان", allTools: "هەموو ئامرازەکان", allUsers: "هەموو بەکارهێنەران" },
};

export function AdminLedgerPanel() {
  const { lang } = useI18n();
  const L = (T as any)[lang] || T.ar;
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [toolFilter, setToolFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [days, setDays] = useState<number>(30);

  async function load() {
    setBusy(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [{ data: led }, { data: profs }] = await Promise.all([
      supabase.from("token_ledger").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("id,email,full_name,username"),
    ]);
    setRows((led || []) as any);
    setProfiles(Object.fromEntries(((profs || []) as Profile[]).map((p) => [p.id, p])));
    setBusy(false);
  }
  useEffect(() => { load(); }, [days]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (toolFilter && r.tool_key !== toolFilter) return false;
      if (userFilter && r.user_id !== userFilter) return false;
      if (s) {
        const p = profiles[r.user_id];
        const hay = `${p?.email || ""} ${p?.full_name || ""} ${p?.username || ""} ${r.tool_key}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, q, toolFilter, userFilter, profiles]);

  // Summary stats from filtered set
  const stats = useMemo(() => {
    const totals = { tokens: 0, usd: 0, todayT: 0, todayU: 0, monthT: 0, monthU: 0 };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const byTool: Record<string, { tokens: number; usd: number }> = {};
    const byUser: Record<string, { tokens: number; usd: number }> = {};
    for (const r of filtered) {
      const u = Number(r.usd_cost) || 0;
      totals.tokens += r.tokens; totals.usd += u;
      const at = new Date(r.created_at);
      if (at >= today) { totals.todayT += r.tokens; totals.todayU += u; }
      if (at >= monthStart) { totals.monthT += r.tokens; totals.monthU += u; }
      byTool[r.tool_key] = byTool[r.tool_key] || { tokens: 0, usd: 0 };
      byTool[r.tool_key].tokens += r.tokens; byTool[r.tool_key].usd += u;
      byUser[r.user_id] = byUser[r.user_id] || { tokens: 0, usd: 0 };
      byUser[r.user_id].tokens += r.tokens; byUser[r.user_id].usd += u;
    }
    const topTools = Object.entries(byTool).sort((a, b) => b[1].usd - a[1].usd).slice(0, 5);
    const topUsers = Object.entries(byUser).sort((a, b) => b[1].usd - a[1].usd).slice(0, 5);
    return { totals, topTools, topUsers };
  }, [filtered]);

  function exportCsv() {
    const cols = [L.time, L.user, L.tool, L.tokens, L.usd, L.run];
    const data = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      profiles[r.user_id]?.email || r.user_id,
      r.tool_key,
      r.tokens,
      Number(r.usd_cost).toFixed(6),
      r.run_id || "",
    ]);
    exportToCSV({
      title: "token-ledger",
      lang: (lang as any) || "ar",
      sections: [{ heading: L.title, kind: "table", table: { columns: cols, data } }],
    });
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Activity className="size-5 text-primary" /> {L.title}</h2>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">
          <Download className="size-3.5" /> {L.export}
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatBox label={L.today} tokens={stats.totals.todayT} usd={stats.totals.todayU} />
        <StatBox label={L.month} tokens={stats.totals.monthT} usd={stats.totals.monthU} />
        <StatBox label={L.total} tokens={stats.totals.tokens} usd={stats.totals.usd} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TopList title={L.topTools} entries={stats.topTools.map(([k, v]) => ({ name: toolLabel(k as any, lang as any), tokens: v.tokens, usd: v.usd }))} />
        <TopList title={L.topUsers} entries={stats.topUsers.map(([uid, v]) => ({ name: profiles[uid]?.email || uid, tokens: v.tokens, usd: v.usd }))} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} className="rounded-full border border-border bg-card/60 py-2 pr-9 pl-3 text-sm w-64" />
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

      {busy ? (
        <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs">
              <tr>
                <th className="p-2 text-start">{L.time}</th>
                <th className="p-2 text-start">{L.user}</th>
                <th className="p-2 text-start">{L.tool}</th>
                <th className="p-2 text-end">{L.tokens}</th>
                <th className="p-2 text-end">{L.usd}</th>
                <th className="p-2 text-start">{L.run}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => {
                const p = profiles[r.user_id];
                return (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2 text-xs">{p?.email || p?.username || r.user_id.slice(0, 8)}</td>
                    <td className="p-2 text-xs">{toolLabel(r.tool_key as any, lang as any)}</td>
                    <td className="p-2 text-end font-semibold text-primary">{r.tokens.toLocaleString()}</td>
                    <td className="p-2 text-end text-emerald-500 font-medium">{formatUsd(Number(r.usd_cost))}</td>
                    <td className="p-2 text-[10px] text-muted-foreground">{r.run_id?.slice(0, 8) || "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{L.noResults}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, tokens, usd }: { label: string; tokens: number; usd: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2"><CostBadge tokens={tokens} usd={usd} /></div>
    </div>
  );
}

function TopList({ title, entries }: { title: string; entries: { name: string; tokens: number; usd: number }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className="space-y-1.5">
        {entries.length === 0 && <li className="text-xs text-muted-foreground">—</li>}
        {entries.map((e, i) => (
          <li key={i} className="flex items-center justify-between text-xs">
            <span className="truncate">{i + 1}. {e.name}</span>
            <CostBadge tokens={e.tokens} usd={e.usd} compact />
          </li>
        ))}
      </ul>
    </div>
  );
}
