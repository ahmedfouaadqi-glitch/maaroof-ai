// Admin tab for Maaroof: Overview / Runs / Agents / Capabilities / Memory / Controls
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, ListChecks, Brain, Settings2, Trash2, RefreshCw, Power, Bot, Archive, Network } from "lucide-react";

type RunRow = { id: string; user_id: string; goal: string; status: string; started_at: string; finished_at: string | null; total_usd: number | string | null; total_tokens: number | null; steps_count: number | null; detected_geo: any; geo_scope: any; error: string | null };
type MemRow = { id: string; user_id: string; kind: string; content: string; importance: number; last_accessed_at: string; created_at: string };
type SettingRow = { key: string; value: any; updated_at: string };
type AgentRow = { id: string; role: string | null; mission: string | null; dna: any; version: number; lifecycle_state: string; success_rate: number | null; runs_count: number | null; cost_breakdown: any; updated_at: string | null; created_at: string };
type CapRow = { capability: string; runs: number | null; success_rate: number | null; avg_usd: number | null; avg_tokens: number | null; last_used_at: string | null; top_tool: string | null };

const SUB_TABS = [
  { k: "overview", label: "نظرة عامة", Icon: Activity },
  { k: "runs", label: "الجلسات", Icon: ListChecks },
  { k: "agents", label: "الوكلاء", Icon: Bot },
  { k: "capabilities", label: "القدرات", Icon: Network },
  { k: "memory", label: "الذاكرة", Icon: Brain },
  { k: "controls", label: "التحكم", Icon: Settings2 },
] as const;

export function MaaroofAdminTab() {
  const [sub, setSub] = useState<typeof SUB_TABS[number]["k"]>("overview");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b">
        {SUB_TABS.map(({ k, label, Icon }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`px-3 py-2 text-sm border-b-2 flex items-center gap-2 ${sub === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {sub === "overview" && <OverviewSection />}
      {sub === "runs" && <RunsSection />}
      {sub === "agents" && <AgentsSection />}
      {sub === "memory" && <MemorySection />}
      {sub === "controls" && <ControlsSection />}
    </div>
  );
}

/* ---------- Agents Registry ---------- */
function AgentsSection() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "standby" | "archived">("all");

  async function load() {
    setLoading(true);
    let q = supabase.from("maaroof_agents").select("*").order("updated_at", { ascending: false, nullsFirst: false }).limit(200);
    if (filter !== "all") q = q.eq("lifecycle_state", filter);
    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filter]);

  async function setState(id: string, state: string) {
    await supabase.from("maaroof_agents").update({ lifecycle_state: state }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("حذف الوكيل نهائياً؟")) return;
    await supabase.from("maaroof_agents").delete().eq("id", id);
    load();
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">التصفية:</span>
        {(["all", "active", "standby", "archived"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-2 py-1 rounded-full border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {f}
          </button>
        ))}
        <button onClick={load} className="text-xs px-2 py-1 rounded-full border hover:bg-muted ms-auto flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> تحديث
        </button>
      </div>

      {rows.length === 0 && <div className="text-sm text-muted-foreground p-6 text-center">لا يوجد وكلاء بعد.</div>}

      <div className="grid gap-2">
        {rows.map((a) => (
          <div key={a.id} className="rounded-lg border bg-card p-3 flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 font-semibold">
                <Bot className="w-4 h-4 text-primary" />
                <span>{a.role || "agent"}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">v{a.version}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  a.lifecycle_state === "active" ? "bg-emerald-500/15 text-emerald-600" :
                  a.lifecycle_state === "standby" ? "bg-amber-500/15 text-amber-600" :
                  "bg-muted text-muted-foreground"
                }`}>{a.lifecycle_state}</span>
              </div>
              {a.mission && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.mission}</div>}
              <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-3">
                <span>Runs: {a.runs_count ?? 0}</span>
                <span>Success: {typeof a.success_rate === "number" ? `${(a.success_rate * 100).toFixed(0)}%` : "—"}</span>
                <span>Cost: ${Number(a.cost_breakdown?.total_usd || 0).toFixed(4)}</span>
                <span>Last: {a.updated_at ? new Date(a.updated_at).toLocaleString() : "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {a.lifecycle_state !== "standby" && (
                <button onClick={() => setState(a.id, "standby")} title="Standby"
                  className="text-xs px-2 py-1 rounded border hover:bg-muted">Standby</button>
              )}
              {a.lifecycle_state !== "archived" && (
                <button onClick={() => setState(a.id, "archived")} title="Archive"
                  className="text-xs px-2 py-1 rounded border hover:bg-muted flex items-center gap-1">
                  <Archive className="w-3 h-3" /> Archive
                </button>
              )}
              <button onClick={() => remove(a.id)} title="حذف"
                className="text-xs px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ---------- Overview ---------- */
function OverviewSection() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunRow[]>([]);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data } = await supabase.from("maaroof_runs").select("*").gte("started_at", since).order("started_at", { ascending: false }).limit(500);
      setRuns((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const k7 = useMemo(() => agg(runs, 7), [runs]);
  const k30 = useMemo(() => agg(runs, 30), [runs]);
  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of runs) {
      const c = (r.detected_geo as any)?.country || (r.geo_scope as any)?.country || "—";
      m.set(c, (m.get(c) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [runs]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="جلسات 7 أيام" value={k7.count} />
        <Kpi label="نجاح 7 أيام" value={`${k7.successPct}%`} />
        <Kpi label="تكلفة 7 أيام" value={`$${k7.usd.toFixed(4)}`} />
        <Kpi label="متوسط/جلسة" value={`$${k7.avgUsd.toFixed(4)}`} />
        <Kpi label="جلسات 30 يوم" value={k30.count} />
        <Kpi label="نجاح 30 يوم" value={`${k30.successPct}%`} />
        <Kpi label="تكلفة 30 يوم" value={`$${k30.usd.toFixed(4)}`} />
        <Kpi label="متوسط خطوات" value={k30.avgSteps.toFixed(1)} />
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="font-semibold mb-2 text-sm">أعلى 10 دول</div>
        <div className="space-y-1">
          {byCountry.map(([c, n]) => (
            <div key={c} className="flex items-center gap-2 text-xs">
              <span className="w-12 font-mono">{c}</span>
              <div className="flex-1 h-2 bg-muted rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (n / byCountry[0][1]) * 100)}%` }} /></div>
              <span className="w-10 text-end">{n}</span>
            </div>
          ))}
          {byCountry.length === 0 && <div className="text-xs text-muted-foreground">لا توجد بيانات بعد.</div>}
        </div>
      </div>
    </div>
  );
}

function agg(runs: RunRow[], days: number) {
  const since = Date.now() - days * 86400_000;
  const list = runs.filter((r) => new Date(r.started_at).getTime() >= since);
  const count = list.length;
  const success = list.filter((r) => r.status === "done").length;
  const usd = list.reduce((s, r) => s + Number(r.total_usd || 0), 0);
  const steps = list.reduce((s, r) => s + Number(r.steps_count || 0), 0);
  return {
    count, usd,
    successPct: count ? Math.round((success / count) * 100) : 0,
    avgUsd: count ? usd / count : 0,
    avgSteps: count ? steps / count : 0,
  };
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

/* ---------- Runs ---------- */
function RunsSection() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    let qy = supabase.from("maaroof_runs").select("*").order("started_at", { ascending: false }).limit(200);
    if (status) qy = qy.eq("status", status);
    const { data } = await qy;
    setRows(((data as any) || []).filter((r: any) => !q || r.goal?.toLowerCase().includes(q.toLowerCase())));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const forceStop = async (id: string) => {
    await supabase.from("maaroof_runs").update({ status: "error", error: "force_stopped_by_admin", finished_at: new Date().toISOString() }).eq("id", id);
    load();
  };
  const del = async (id: string) => {
    if (!confirm("حذف الجلسة وكل رسائلها؟")) return;
    await supabase.from("maaroof_messages").delete().eq("run_id", id);
    await supabase.from("maaroof_runs").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="بحث في الهدف…" className="border rounded px-2 py-1 bg-background text-sm flex-1 min-w-[200px]" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1 bg-background text-sm">
          <option value="">كل الحالات</option>
          <option value="running">قيد التشغيل</option>
          <option value="done">منجز</option>
          <option value="error">خطأ</option>
        </select>
        <button onClick={load} className="px-3 py-1 border rounded text-sm flex items-center gap-1"><RefreshCw className="w-3 h-3" /> تحديث</button>
      </div>
      {loading ? <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground"><th className="p-2 text-start">التاريخ</th><th className="p-2 text-start">الهدف</th><th className="p-2">الحالة</th><th className="p-2">الخطوات</th><th className="p-2">التكلفة $</th><th className="p-2">دولة</th><th className="p-2">إجراءات</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">{new Date(r.started_at).toLocaleString("ar-IQ")}</td>
                  <td className="p-2 max-w-[260px] truncate" title={r.goal}>{r.goal}</td>
                  <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] ${r.status === "done" ? "bg-green-500/10 text-green-500" : r.status === "error" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}`}>{r.status}</span></td>
                  <td className="p-2 text-center">{r.steps_count ?? "—"}</td>
                  <td className="p-2 text-center font-mono">{Number(r.total_usd || 0).toFixed(4)}</td>
                  <td className="p-2 text-center font-mono">{(r.detected_geo as any)?.country || (r.geo_scope as any)?.country || "—"}</td>
                  <td className="p-2 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      {r.status === "running" && <button onClick={() => forceStop(r.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="إيقاف قسري"><Power className="w-3 h-3" /></button>}
                      <button onClick={() => del(r.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="حذف"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">لا توجد جلسات.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Memory ---------- */
function MemorySection() {
  const [rows, setRows] = useState<MemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("maaroof_memory").select("*").order("last_accessed_at", { ascending: false }).limit(500);
    setRows(((data as any) || []).filter((r: any) => !q || r.content?.toLowerCase().includes(q.toLowerCase())));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const del = async (id: string) => { await supabase.from("maaroof_memory").delete().eq("id", id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="بحث…" className="border rounded px-2 py-1 bg-background text-sm flex-1" />
        <button onClick={load} className="px-3 py-1 border rounded text-sm"><RefreshCw className="w-3 h-3 inline" /></button>
      </div>
      {loading ? <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground"><th className="p-2 text-start">المستخدم</th><th className="p-2">النوع</th><th className="p-2 text-start">المحتوى</th><th className="p-2">أهمية</th><th className="p-2">آخر استخدام</th><th className="p-2">×</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono text-[10px]">{r.user_id.slice(0, 8)}</td>
                  <td className="p-2 text-center">{r.kind}</td>
                  <td className="p-2 max-w-[400px] truncate" title={r.content}>{r.content}</td>
                  <td className="p-2 text-center">{r.importance}</td>
                  <td className="p-2 text-center whitespace-nowrap">{new Date(r.last_accessed_at).toLocaleDateString("ar-IQ")}</td>
                  <td className="p-2 text-center"><button onClick={() => del(r.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="w-3 h-3" /></button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">لا توجد ذاكرة.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Controls ---------- */
const ALL_TOOLS = ["analyze","suggest","compare","feasibility","bizdev","research","visibility","brand_boost","company_email","applied_ranking","geo_strategist","competitor_monitor","social_analysis","what_if","brand_authority","geo_rewrite"];

function ControlsSection() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { (async () => {
    setLoading(true);
    const { data } = await supabase.from("maaroof_settings").select("*");
    const m: Record<string, any> = {};
    for (const r of (data as SettingRow[] | null) || []) m[r.key] = r.value;
    setSettings(m); setLoading(false);
  })(); }, []);

  const set = (k: string, v: any) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg("");
    const { data: u } = await supabase.auth.getUser();
    const updated_by = u.user?.id;
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value, updated_by, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("maaroof_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    setMsg(error ? `خطأ: ${error.message}` : "تم الحفظ ✓");
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  const enabled: string[] = Array.isArray(settings.enabled_tools) ? settings.enabled_tools : [];
  const toggleTool = (t: string) => set("enabled_tools", enabled.includes(t) ? enabled.filter((x) => x !== t) : [...enabled, t]);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border bg-destructive/5 border-destructive/30 p-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!settings.kill_switch} onChange={(e) => set("kill_switch", e.target.checked)} />
          <span className="font-semibold text-destructive">إيقاف كامل لمعروف (Kill switch)</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1">عند التفعيل، أي طلب جديد يُرفض برسالة للمستخدم.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NumField label="السقف اليومي للتجربة" k="trial_daily_cap" v={settings.trial_daily_cap} set={set} />
        <NumField label="مهلة الأداة (ms)" k="tool_timeout_ms" v={settings.tool_timeout_ms} set={set} />
        <NumField label="أقصى عدد خطوات" k="max_steps" v={settings.max_steps} set={set} />
        <NumField label="أقصى طول للهدف (حرف)" k="max_goal_chars" v={settings.max_goal_chars} set={set} />
        <TxtField label="نموذج التخطيط" k="planner_model" v={settings.planner_model} set={set} />
        <TxtField label="النموذج الاحتياطي" k="fallback_model" v={settings.fallback_model} set={set} />
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="font-semibold mb-2 text-sm">الأدوات المُفعّلة</div>
        <div className="flex flex-wrap gap-2">
          {ALL_TOOLS.map((t) => (
            <button key={t} onClick={() => toggleTool(t)} className={`px-2 py-1 text-xs rounded border ${enabled.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <label className="text-sm font-semibold block mb-1">توجيهات نظام إضافية (تُلحَق بالـ system prompt)</label>
        <textarea value={settings.system_prompt_extra || ""} onChange={(e) => set("system_prompt_extra", e.target.value)} rows={4} className="w-full border rounded p-2 bg-background text-sm" placeholder="مثال: ركّز على السوق العراقي وأعط أمثلة محلية." />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50">{saving ? "..." : "حفظ"}</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function NumField({ label, k, v, set }: { label: string; k: string; v: any; set: (k: string, v: any) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="number" value={v ?? ""} onChange={(e) => set(k, Number(e.target.value))} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1" />
    </label>
  );
}
function TxtField({ label, k, v, set }: { label: string; k: string; v: any; set: (k: string, v: any) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="text" value={v ?? ""} onChange={(e) => set(k, e.target.value)} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1 font-mono" />
    </label>
  );
}
