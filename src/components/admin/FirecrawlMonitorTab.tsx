import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Flame, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting } from "@/lib/admin.functions";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { useAdminL } from "./admin-i18n";

type Row = { id: string; user_id: string | null; tool_key: string | null; op: string; units: number; cache_hit: boolean; latency_ms: number | null; status: number | null; created_at: string };

const DEFAULT_POLICY = {
  global_daily: 2000, global_monthly: 50000, per_user_daily: 100,
  per_tool: {} as Record<string, number>, cache_ttl_hours: 24,
};

export function FirecrawlMonitorTab() {
  const L = useAdminL({
    title: { ar: "مراقبة Firecrawl", en: "Firecrawl monitor", ku: "چاودێری Firecrawl" },
    today: { ar: "اليوم", en: "Today", ku: "ئەمڕۆ" },
    month: { ar: "آخر 30 يوم", en: "Last 30 days", ku: "30 ڕۆژ" },
    calls: { ar: "نداءات", en: "Calls", ku: "بانگەکان" },
    cacheHits: { ar: "تخفيف عبر الكاش", en: "Cache hits", ku: "کاش" },
    units: { ar: "وحدات Firecrawl", en: "Units", ku: "یەکە" },
    avgLatency: { ar: "متوسط الزمن", en: "Avg latency", ku: "ناوەند" },
    policy: { ar: "حدود الاستهلاك", en: "Usage limits", ku: "سنوور" },
    globalDay: { ar: "حد عالمي / يوم", en: "Global per day", ku: "" },
    globalMo: { ar: "حد عالمي / 30 يوم", en: "Global per month", ku: "" },
    perUserDay: { ar: "حد لكل مستخدم / يوم", en: "Per user / day", ku: "" },
    cacheTtl: { ar: "مدة الكاش (ساعات)", en: "Cache TTL (hours)", ku: "" },
    perTool: { ar: "حد شهري لكل أداة", en: "Monthly cap per tool", ku: "" },
    save: { ar: "حفظ السياسة", en: "Save policy", ku: "هەڵگرتن" },
    saved: { ar: "تم الحفظ.", en: "Saved.", ku: "" },
    topTools: { ar: "أعلى الأدوات استهلاكاً", en: "Top tools by units", ku: "" },
    topUsers: { ar: "أعلى المستخدمين", en: "Top users", ku: "" },
    reload: { ar: "تحديث", en: "Reload", ku: "" },
    recent: { ar: "آخر العمليات", en: "Recent calls", ku: "" },
    op: { ar: "العملية", en: "Op", ku: "" },
    tool: { ar: "الأداة", en: "Tool", ku: "" },
    user: { ar: "المستخدم", en: "User", ku: "" },
    when: { ar: "الوقت", en: "Time", ku: "" },
    none: { ar: "لا توجد بيانات.", en: "No data.", ku: "" },
  });

  const setSetting = useServerFn(adminSetAppSetting);
  const [rows, setRows] = useState<Row[]>([]);
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: u }, { data: cfg }, { data: profs }] = await Promise.all([
      supabase.from("firecrawl_usage").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
      supabase.from("app_settings").select("value").eq("key", "firecrawl_policy").maybeSingle(),
      supabase.from("profiles").select("id,email").limit(500),
    ]);
    setRows((u || []) as any);
    if (cfg?.value) setPolicy({ ...DEFAULT_POLICY, ...(cfg.value as any) });
    setProfiles(Object.fromEntries(((profs || []) as any[]).map((p) => [p.id, p.email || p.id.slice(0, 8)])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayStart = now - 86400000;
    let dayCalls = 0, dayHits = 0, dayUnits = 0;
    let moCalls = 0, moHits = 0, moUnits = 0;
    let latSum = 0, latN = 0;
    const byTool: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      moCalls++; if (r.cache_hit) moHits++; moUnits += r.units;
      if (r.latency_ms != null) { latSum += r.latency_ms; latN++; }
      if (t >= dayStart) { dayCalls++; if (r.cache_hit) dayHits++; dayUnits += r.units; }
      if (r.tool_key) byTool[r.tool_key] = (byTool[r.tool_key] || 0) + r.units;
      if (r.user_id) byUser[r.user_id] = (byUser[r.user_id] || 0) + r.units;
    }
    return {
      dayCalls, dayHits, dayUnits, moCalls, moHits, moUnits,
      avgLat: latN ? Math.round(latSum / latN) : 0,
      topTools: Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 8),
      topUsers: Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [rows]);

  const save = async () => {
    setBusy(true);
    try { await setSetting({ data: { key: "firecrawl_policy", value: policy as any } }); alert(L.saved); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Flame className="size-5 text-primary" /> {L.title}</h2>
        <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"><RefreshCw className="size-3.5" /> {L.reload}</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Stat label={`${L.today} · ${L.calls}`} v={`${stats.dayCalls}`} sub={`${L.cacheHits}: ${stats.dayHits}`} />
        <Stat label={`${L.today} · ${L.units}`} v={`${stats.dayUnits}`} />
        <Stat label={`${L.month} · ${L.calls}`} v={`${stats.moCalls}`} sub={`${L.cacheHits}: ${stats.moHits}`} />
        <Stat label={L.avgLatency} v={`${stats.avgLat} ms`} />
      </div>

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-3 font-semibold">{L.policy}</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Num label={L.globalDay} v={policy.global_daily} on={(n) => setPolicy({ ...policy, global_daily: n })} />
          <Num label={L.globalMo} v={policy.global_monthly} on={(n) => setPolicy({ ...policy, global_monthly: n })} />
          <Num label={L.perUserDay} v={policy.per_user_daily} on={(n) => setPolicy({ ...policy, per_user_daily: n })} />
          <Num label={L.cacheTtl} v={policy.cache_ttl_hours} on={(n) => setPolicy({ ...policy, cache_ttl_hours: n })} />
        </div>
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">{L.perTool}</div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {TOOL_CATALOG.map((t) => (
              <div key={t.key} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2 text-xs">
                <span className="font-mono text-[10px] text-muted-foreground flex-1 truncate">{t.key}</span>
                <input type="number" min={0} value={policy.per_tool[t.key] ?? ""} placeholder="∞"
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...policy.per_tool };
                    if (v === "") delete next[t.key]; else next[t.key] = Number(v);
                    setPolicy({ ...policy, per_tool: next });
                  }}
                  className="w-20 rounded border border-border bg-background/60 px-2 py-1 text-xs" />
              </div>
            ))}
          </div>
        </div>
        <button onClick={save} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {L.save}
        </button>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <TopList title={L.topTools} rows={stats.topTools} />
        <TopList title={L.topUsers} rows={stats.topUsers.map(([uid, v]) => [profiles[uid] || uid.slice(0, 8), v])} />
      </div>

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-3 font-semibold">{L.recent}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-2 py-2 text-start">{L.when}</th>
                <th className="px-2 py-2 text-start">{L.op}</th>
                <th className="px-2 py-2 text-start">{L.tool}</th>
                <th className="px-2 py-2 text-start">{L.user}</th>
                <th className="px-2 py-2 text-end">{L.units}</th>
                <th className="px-2 py-2 text-end">{L.cacheHits}</th>
                <th className="px-2 py-2 text-end">ms</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="px-2 py-1.5 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1.5">{r.op}</td>
                  <td className="px-2 py-1.5">{r.tool_key || "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{r.user_id ? (profiles[r.user_id] || r.user_id.slice(0,8)) : "—"}</td>
                  <td className="px-2 py-1.5 text-end font-mono">{r.units}</td>
                  <td className="px-2 py-1.5 text-end">{r.cache_hit ? "✓" : ""}</td>
                  <td className="px-2 py-1.5 text-end font-mono">{r.latency_ms ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">{L.none}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, v, sub }: { label: string; v: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-gradient">{v}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
function Num({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <label className="text-xs">
      <span className="block mb-1 text-muted-foreground">{label}</span>
      <input type="number" min={0} value={v} onChange={(e) => on(Number(e.target.value) || 0)}
        className="w-full rounded border border-border bg-background/60 px-2 py-1.5 text-sm" />
    </label>
  );
}
function TopList({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className="space-y-1.5">
        {rows.length === 0 && <li className="text-xs text-muted-foreground">—</li>}
        {rows.map(([k, v], i) => (
          <li key={i} className="flex items-center justify-between text-xs">
            <span className="truncate">{i + 1}. {k}</span>
            <span className="font-mono text-primary">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
