// Admin tab for Maaroof: Overview / Runs / Agents / Capabilities / Memory / Controls
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
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
      {sub === "capabilities" && <CapabilitiesSection />}
      {sub === "memory" && <MemorySection />}
      {sub === "controls" && <ControlsSection />}
    </div>
  );
}

/* ---------- Capabilities (Part 4) ---------- */
function CapabilitiesSection() {
  const { t } = useI18n();
  const [rows, setRows] = useState<CapRow[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const { data } = await supabase.from("capability_scores_v" as any).select("*");
    setRows(((data as any) || []) as CapRow[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;
  const sorted = [...rows].sort((a, b) => (b.runs || 0) - (a.runs || 0));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("auto.live_capabilities_matrix_built_automatically_from")}</span>
        <button onClick={load} className="text-xs px-2 py-1 rounded border hover:bg-muted ms-auto flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t("auto.update")}</button>
      </div>
      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center">{t("auto.no_data_yet_run_some_sessions")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground">
              <th className="p-2 text-start">{t("auto.ability")}</th>
              <th className="p-2">{t("auto.top_expert")}</th>
              <th className="p-2">{t("auto.sessions_2")}</th>
              <th className="p-2">{t("auto.success")}</th>
              <th className="p-2">{t("auto.avg_cost")}</th>
              <th className="p-2">{t("auto.avg_token")}</th>
              <th className="p-2">{t("auto.last_used")}</th>
            </tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.capability} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono">{r.capability}</td>
                  <td className="p-2 text-center font-mono">{r.top_tool || "—"}</td>
                  <td className="p-2 text-center">{r.runs ?? 0}</td>
                  <td className="p-2 text-center">{r.success_rate == null ? "—" : `${(Number(r.success_rate) * 100).toFixed(0)}%`}</td>
                  <td className="p-2 text-center font-mono">{r.avg_usd == null ? "—" : Number(r.avg_usd).toFixed(4)}</td>
                  <td className="p-2 text-center font-mono">{r.avg_tokens == null ? "—" : Math.round(Number(r.avg_tokens))}</td>
                  <td className="p-2 text-center whitespace-nowrap">{r.last_used_at ? new Date(r.last_used_at).toLocaleDateString("ar-IQ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Agents Registry ---------- */
function AgentsSection() {
  const { t } = useI18n();
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
    if (!confirm(t("auto.delete_proxy_permanently"))) return;
    await supabase.from("maaroof_agents").delete().eq("id", id);
    load();
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">{t("auto.filter")}</span>
        {(["all", "active", "standby", "archived"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-2 py-1 rounded-full border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {f}
          </button>
        ))}
        <button onClick={load} className="text-xs px-2 py-1 rounded-full border hover:bg-muted ms-auto flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> {t("auto.update")}
        </button>
      </div>

      {rows.length === 0 && <div className="text-sm text-muted-foreground p-6 text-center">{t("auto.no_agents_yet")}</div>}

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
              <button onClick={() => remove(a.id)} title={t("auto.delete")}
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
  const { t } = useI18n();
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
        <Kpi label={t("auto.7_day_sessions")} value={k7.count} />
        <Kpi label={t("auto.7_day_success")} value={`${k7.successPct}%`} />
        <Kpi label={t("auto.cost_7_days")} value={`$${k7.usd.toFixed(4)}`} />
        <Kpi label={t("auto.average_session")} value={`$${k7.avgUsd.toFixed(4)}`} />
        <Kpi label={t("auto.30_day_sessions")} value={k30.count} />
        <Kpi label={t("auto.30_day_success")} value={`${k30.successPct}%`} />
        <Kpi label={t("auto.cost_30_days")} value={`$${k30.usd.toFixed(4)}`} />
        <Kpi label={t("auto.steps_average")} value={k30.avgSteps.toFixed(1)} />
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="font-semibold mb-2 text-sm">{t("auto.top_10_countries")}</div>
        <div className="space-y-1">
          {byCountry.map(([c, n]) => (
            <div key={c} className="flex items-center gap-2 text-xs">
              <span className="w-12 font-mono">{c}</span>
              <div className="flex-1 h-2 bg-muted rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (n / byCountry[0][1]) * 100)}%` }} /></div>
              <span className="w-10 text-end">{n}</span>
            </div>
          ))}
          {byCountry.length === 0 && <div className="text-xs text-muted-foreground">{t("auto.no_data_yet")}</div>}
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
  const { t } = useI18n();
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
    if (!confirm(t("auto.delete_session_and_all_its_messages"))) return;
    await supabase.from("maaroof_messages").delete().eq("run_id", id);
    await supabase.from("maaroof_runs").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={t("auto.search_goal")} className="border rounded px-2 py-1 bg-background text-sm flex-1 min-w-[200px]" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1 bg-background text-sm">
          <option value="">{t("auto.all_cases")}</option>
          <option value="running">{t("auto.running")}</option>
          <option value="done">{t("auto.completed")}</option>
          <option value="error">{t("auto.error")}</option>
        </select>
        <button onClick={load} className="px-3 py-1 border rounded text-sm flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t("auto.update")}</button>
      </div>
      {loading ? <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground"><th className="p-2 text-start">{t("auto.date")}</th><th className="p-2 text-start">{t("auto.target")}</th><th className="p-2">{t("auto.status")}</th><th className="p-2">{t("auto.steps")}</th><th className="p-2">{t("auto.cost_2")}</th><th className="p-2">{t("auto.country")}</th><th className="p-2">{t("auto.actions")}</th></tr></thead>
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
                      {r.status === "running" && <button onClick={() => forceStop(r.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title={t("auto.forced_stop")}><Power className="w-3 h-3" /></button>}
                      <button onClick={() => del(r.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title={t("auto.delete")}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{t("auto.no_sessions")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Memory ---------- */
function MemorySection() {
  const { t } = useI18n();
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
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder={t("auto.search_2")} className="border rounded px-2 py-1 bg-background text-sm flex-1" />
        <button onClick={load} className="px-3 py-1 border rounded text-sm"><RefreshCw className="w-3 h-3 inline" /></button>
      </div>
      {loading ? <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground"><th className="p-2 text-start">{t("auto.user")}</th><th className="p-2">{t("auto.type")}</th><th className="p-2 text-start">{t("auto.content")}</th><th className="p-2">{t("auto.importance")}</th><th className="p-2">{t("auto.last_used")}</th><th className="p-2">×</th></tr></thead>
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
              {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{t("auto.no_memory")}</td></tr>}
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
  const { t } = useI18n();
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
    setMsg(error ? `خطأ: ${error.message}` : t("auto.saved_2"));
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
          <span className="font-semibold text-destructive">{t("auto.maaroof_kill_switch")}</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1">{t("auto.when_activated_any_new_request_is")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NumField label={t("auto.daily_trial_limit")} k="trial_daily_cap" v={settings.trial_daily_cap} set={set} />
        <NumField label={t("auto.tool_timeout_ms")} k="tool_timeout_ms" v={settings.tool_timeout_ms} set={set} />
        <NumField label={t("auto.max_steps")} k="max_steps" v={settings.max_steps} set={set} />
        <NumField label={t("auto.max_target_length_chars")} k="max_goal_chars" v={settings.max_goal_chars} set={set} />
        <TxtField label={t("auto.planning_model")} k="planner_model" v={settings.planner_model} set={set} />
        <TxtField label={t("auto.fallback_model")} k="fallback_model" v={settings.fallback_model} set={set} />
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="font-semibold mb-2 text-sm">{t("auto.enabled_tools")}</div>
        <div className="flex flex-wrap gap-2">
          {ALL_TOOLS.map((t) => (
            <button key={t} onClick={() => toggleTool(t)} className={`px-2 py-1 text-xs rounded border ${enabled.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      <ExecutiveControls settings={settings} set={set} />

      <LawsControls settings={settings} set={set} />

      <LearningControls settings={settings} set={set} />

      <GovernanceControls settings={settings} set={set} />


      <div className="rounded-lg border bg-card p-3">
        <label className="text-sm font-semibold block mb-1">{t("auto.additional_system_instructions_appended_to_the")}</label>
        <textarea value={settings.system_prompt_extra || ""} onChange={(e) => set("system_prompt_extra", e.target.value)} rows={4} className="w-full border rounded p-2 bg-background text-sm" placeholder={t("auto.example_focus_on_the_iraqi_market")} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50">{saving ? "..." : t("auto.save")}</button>
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

/* ---------- Part 7 — Executive Intelligence controls ---------- */
const EXEC_FLAGS: Array<{ k: string; label: string; hint: string }> = [
  { k: "personality_enabled", label: "شخصية الوكيل التنفيذية", hint: "تتطور سمات الوكيل بعد كل جلسة (جرأة، حذر، تحليل…)." },
  { k: "conflict_enabled", label: "محرك التعارض المعرفي", hint: "نقاش إضافي فقط عند اختلاف المجلس — تكلفة إضافية نادرة." },
  { k: "timing_enabled", label: "محرك التوقيت الاستراتيجي", hint: "يقرر: نفّذ الآن / أجّل / جدول / راقب / ألغِ (بدون تكلفة نموذج)." },
  { k: "trust_enabled", label: "محرك الثقة والأدلة", hint: "يرفق الأدلة والافتراضات والحدود مع الإجابة النهائية." },
  { k: "genome_enabled", label: "الجينوم الرقمي", hint: "هوية دائمة للمساحة والوكيل تُحقن في التوجيه." },
  { k: "future_dna_enabled", label: "حمض المستقبل (Future DNA)", hint: "يسجّل أنماطاً مجهولة الهوية من النجاح والفشل معاً." },
];

function ExecutiveControls({ settings, set }: { settings: Record<string, any>; set: (k: string, v: any) => void }) {
  const exec = (settings.executive || {}) as Record<string, any>;
  const patch = (k: string, v: any) => set("executive", { ...exec, [k]: v });
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={!!exec.enabled} onChange={(e) => patch("enabled", e.target.checked)} />
        <span className="font-semibold text-sm">{t("auto.executive_intelligence_part_vii")}</span>
      </label>
      <p className="text-xs text-muted-foreground -mt-1">{t("auto.an_additional_layer_above_the_current")}</p>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${exec.enabled ? "" : "opacity-50 pointer-events-none"}`}>
        {EXEC_FLAGS.map((f) => (
          <label key={f.k} className="rounded border p-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={!!exec[f.k]} onChange={(e) => patch(f.k, e.target.checked)} />
            <span>
              <span className="text-sm font-medium block">{f.label}</span>
              <span className="text-[11px] text-muted-foreground">{f.hint}</span>
            </span>
          </label>
        ))}
        <label className="rounded border p-2 block">
          <span className="text-xs text-muted-foreground">{t("auto.conflict_threshold_confidence_difference")}</span>
          <input type="number" value={exec.conflict_threshold ?? 25} onChange={(e) => patch("conflict_threshold", Number(e.target.value))} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1" />
        </label>
      </div>
    </div>
  );
}

/* ---------- Part 8 — Laws of Cognitive Intelligence controls ---------- */
const LAW_FLAGS: Array<{ k: string; label: string; hint: string }> = [
  { k: "prompt_injection", label: "حقن الدستور في التوجيه", hint: "يُلحق نص القوانين الثلاثين بالـ system prompt الحالي — بلا طلب إضافي." },
  { k: "enforce_hard_laws", label: "إلزام القوانين الحرجة", hint: "عند خرق قانون إلزامي تُقدَّم الإجابة موسومة كمسودة لا كتوصية نهائية." },
  { k: "log_compliance", label: "حفظ سجل الامتثال", hint: "يخزّن نتيجة التقييم في سجل الجلسة للتدقيق والتقارير." },
];

function LawsControls({ settings, set }: { settings: Record<string, any>; set: (k: string, v: any) => void }) {
  const laws = (settings.laws || {}) as Record<string, any>;
  const patch = (k: string, v: any) => set("laws", { ...laws, [k]: v });
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={!!laws.enabled} onChange={(e) => patch("enabled", e.target.checked)} />
        <span className="font-semibold text-sm">{t("auto.cognitive_ai_constitution_30_laws_part")}</span>
      </label>
      <p className="text-xs text-muted-foreground -mt-1">{t("auto.a_measurement_and_enforcement_layer_over")}</p>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${laws.enabled ? "" : "opacity-50 pointer-events-none"}`}>
        {LAW_FLAGS.map((f) => (
          <label key={f.k} className="rounded border p-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={!!laws[f.k]} onChange={(e) => patch(f.k, e.target.checked)} />
            <span>
              <span className="text-sm font-medium block">{f.label}</span>
              <span className="text-[11px] text-muted-foreground">{f.hint}</span>
            </span>
          </label>
        ))}
        <label className="rounded border p-2 block">
          <span className="text-xs text-muted-foreground">{t("auto.minimum_confidence_threshold_for_law_13")}</span>
          <input type="number" value={laws.min_trust ?? 55} onChange={(e) => patch("min_trust", Number(e.target.value))} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1" />
        </label>
      </div>
    </div>
  );
}

/* ---------- Parts 12-13 — Model Governance & Decision Intelligence controls ---------- */
function GovernanceControls({ settings, set }: { settings: Record<string, any>; set: (k: string, v: any) => void }) {
  const mg = (settings.model_governance || {}) as Record<string, any>;
  const dec = (settings.decision || {}) as Record<string, any>;
  const pub = (settings.publishing || {}) as Record<string, any>;
  const tr = (settings.trust_engine || {}) as Record<string, any>;
  const st = (settings.state_anchor || {}) as Record<string, any>;
  const hm = (settings.hermes || {}) as Record<string, any>;
  const ppub = (k: string, v: any) => set("publishing", { ...pub, [k]: v });
  const ptr = (k: string, v: any) => set("trust_engine", { ...tr, [k]: v });
  const pst = (k: string, v: any) => set("state_anchor", { ...st, [k]: v });
  const phm = (k: string, v: any) => set("hermes", { ...hm, [k]: v });

  const pmg = (k: string, v: any) => set("model_governance", { ...mg, [k]: v });
  const pdec = (k: string, v: any) => set("decision", { ...dec, [k]: v });
  const flag = (
    obj: Record<string, any>,
    patch: (k: string, v: any) => void,
    k: string,
    label: string,
    hint: string,
  ) => (
    <label key={k} className="rounded border p-2 flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={!!obj[k]} onChange={(e) => patch(k, e.target.checked)} />
      <span>
        <span className="text-sm font-medium block">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
  return (
    <div className="rounded-lg border bg-card p-3 space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!mg.enabled} onChange={(e) => pmg("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.ai_model_governance_part_12")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.record_real_priced_models_select_the")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${mg.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          {flag(mg, pmg, "per_phase_selection", t("auto.model_selection_for_each_stage"), t("auto.planning_thinking_answering_learning_each_stage"))}
          {flag(mg, pmg, "use_registry_pricing", t("auto.pricing_from_register"), t("auto.the_actual_cost_is_calculated_from"))}
          {flag(mg, pmg, "health_tracking", t("auto.track_model_health"), t("auto.calls_failures_response_time_and_cumulative"))}
          {flag(mg, pmg, "benchmark_enabled", t("auto.comparative_tests"), t("auto.run_the_same_task_on_multiple"))}
          {flag(mg, pmg, "auto_proposals", t("auto.automatic_upgrade_suggestions"), t("auto.only_suggests_and_does_not_alter"))}
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!dec.enabled} onChange={(e) => pdec("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.executive_decision_intelligence_part_13")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.documenting_decision_stages_from_understanding_the")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${dec.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          {flag(dec, pdec, "trace_enabled", t("auto.document_decision_path"), t("auto.save_the_20_decision_stages_in"))}
          {flag(dec, pdec, "cost_aware_alternatives", t("auto.cost_aware_alternatives"), t("auto.trade_off_between_strategies_based_on"))}
          {flag(dec, pdec, "score_enabled", t("auto.decision_quality_score"), t("auto.a_composite_score_of_coverage_confidence"))}
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!pub.enabled} onChange={(e) => ppub("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.executive_publishing_system_part_14")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.publishing_becomes_a_full_capability_a")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${pub.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          {flag(pub, ppub, "strategy_enabled", t("auto.strategy_per_platform"), t("auto.content_based_on_the_audience_behavior"))}
          {flag(pub, ppub, "campaigns_enabled", t("auto.campaigns_budgets"), t("auto.gather_posts_in_a_campaign_with"))}
          {flag(pub, ppub, "auto_publish_enabled", t("auto.scheduled_auto_publishing"), t("auto.only_works_with_a_consent_mode"))}
          {flag(pub, ppub, "metrics_enabled", t("auto.performance_measurement_after_publishing"), t("auto.access_and_interaction_for_each_post"))}
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${pub.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          <label className="rounded border p-2 text-xs space-y-1">
            <span className="block font-medium">{t("auto.default_approval_status")}</span>
            <select
              className="w-full rounded border bg-background p-1"
              value={pub.default_approval_mode || "always_ask"}
              onChange={(e) => ppub("default_approval_mode", e.target.value)}
            >
              <option value="always_ask">{t("auto.always_ask")}</option>
              <option value="approve_once">{t("auto.approve_once")}</option>
              <option value="campaign_approval">{t("auto.campaign_level_approval")}</option>
              <option value="workspace_policy">{t("auto.according_to_workspace_policy")}</option>
              <option value="fully_automatic">{t("auto.fully_automatic")}</option>
              <option value="emergency_stop">{t("auto.emergency_stop")}</option>
            </select>
          </label>
          <label className="rounded border p-2 text-xs space-y-1">
            <span className="block font-medium">{t("auto.daily_post_limit_per_user")}</span>
            <input
              type="number" min={1} max={200}
              className="w-full rounded border bg-background p-1"
              value={Number(pub.daily_publication_cap ?? 20)}
              onChange={(e) => ppub("daily_publication_cap", Number(e.target.value) || 1)}
            />
          </label>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!tr.enabled} onChange={(e) => ptr("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.executive_trust_engineering_part_15")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.for_each_expert_model_and_tool")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${tr.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          {flag(tr, ptr, "pipeline_enabled", t("auto.verification_path_13_stages"), t("auto.from_source_to_executive_recommendation"))}
          {flag(tr, ptr, "profiles_enabled", t("auto.live_trust_files"), t("auto.a_dynamic_confidence_score_for_each"))}
          {flag(tr, ptr, "executive_score_enabled", t("auto.executive_decision_score"), t("auto.business_value_financial_and_future_impact"))}
          {flag(tr, ptr, "weak_link_alerts", t("auto.weak_link_alert"), t("auto.reveals_the_least_reliable_expert_or"))}
          <label className="rounded border p-2 text-xs space-y-1">
            <span className="block font-medium">{t("auto.minimum_confidence_threshold")}</span>
            <input
              type="number" min={0} max={100}
              className="w-full rounded border bg-background p-1"
              value={Number(tr.min_trust ?? 55)}
              onChange={(e) => ptr("min_trust", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
            <span className="block text-[11px] text-muted-foreground">{t("auto.below_this_threshold_the_answer_is")}</span>
          </label>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!st.enabled} onChange={(e) => pst("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.live_status_anchor_part_16")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.the_identity_message_goal_and_budget")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${st.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          {flag(st, pst, "validate_before_execution", t("auto.verify_before_execution"), t("auto.identity_message_goal_and_budget_are"))}
          {flag(st, pst, "drift_detection", t("auto.deviation_detection"), t("auto.goal_language_workspace_trust_memory_execution"))}
          {flag(st, pst, "timeline_enabled", t("auto.status_timeline"), t("auto.every_change_is_documented_with_its"))}
          {flag(st, pst, "recovery_enabled", t("auto.resume_from_last_known_good"), t("auto.instead_full_restart_after_failure"))}
          <label className="rounded border p-2 text-xs space-y-1">
            <span className="block font-medium">{t("auto.critical_deviation_threshold")}</span>
            <input
              type="number" min={0} max={100}
              className="w-full rounded border bg-background p-1"
              value={Number(st.drift_threshold ?? 60)}
              onChange={(e) => pst("drift_threshold", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
          </label>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!hm.enabled} onChange={(e) => phm("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.hermes_the_founder_s_executive_agent")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.hermes_monitors_the_platform_and_proposes")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${hm.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          {flag(hm, phm, "proposals_enabled", t("auto.generate_suggestions"), t("auto.based_on_real_measured_indicators_only"))}
          {flag(hm, phm, "founder_dna_enabled", t("auto.learn_founder_s_acid"), t("auto.evolves_from_your_approval_and_rejection"))}
          {flag(hm, phm, "office_enabled", t("auto.hermes_office"), t("auto.your_executive_dialogue_based_on_observatory"))}
          <label className="rounded border p-2 flex items-start gap-2 opacity-70">
            <input type="checkbox" className="mt-1" checked readOnly />
            <span>
              <span className="text-sm font-medium block">{t("auto.no_execution_without_consent")}</span>
              <span className="text-[11px] text-muted-foreground">{t("auto.a_constant_constitutional_value_that_cannot")}</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}


/* ---------- Parts 9-11 — Expert Learning & Living Knowledge controls ---------- */
function LearningControls({ settings, set }: { settings: Record<string, any>; set: (k: string, v: any) => void }) {
  const ex = (settings.experts || {}) as Record<string, any>;
  const kn = (settings.knowledge || {}) as Record<string, any>;
  const pex = (k: string, v: any) => set("experts", { ...ex, [k]: v });
  const pkn = (k: string, v: any) => set("knowledge", { ...kn, [k]: v });
  return (
    <div className="rounded-lg border bg-card p-3 space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!ex.enabled} onChange={(e) => pex("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.expert_learning_engine_parts_9_10")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.cognitive_interview_with_each_tool_and")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${ex.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          <label className="rounded border p-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={!!ex.use_snapshots} onChange={(e) => pex("use_snapshots", e.target.checked)} />
            <span>
              <span className="text-sm font-medium block">{t("auto.using_expert_snapshots_in_planning")}</span>
              <span className="text-[11px] text-muted-foreground">{t("auto.the_essence_of_understanding_is_injected")}</span>
            </span>
          </label>
          <label className="rounded border p-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={!!ex.auto_relearn_on_change} onChange={(e) => pex("auto_relearn_on_change", e.target.checked)} />
            <span>
              <span className="text-sm font-medium block">{t("auto.relearn_when_tool_definition_changes")}</span>
              <span className="text-[11px] text-muted-foreground">{t("auto.without_it_the_snapshot_is_reused")}</span>
            </span>
          </label>
          <label className="rounded border p-2 block">
            <span className="text-xs text-muted-foreground">{t("auto.learning_model")}</span>
            <input type="text" value={ex.learning_model ?? "google/gemini-2.5-flash"} onChange={(e) => pex("learning_model", e.target.value)} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1 font-mono" />
          </label>
          <label className="rounded border p-2 block">
            <span className="text-xs text-muted-foreground">{t("auto.monthly_learning_budget_ceiling")}</span>
            <input type="number" step="0.5" value={ex.monthly_budget_usd ?? 5} onChange={(e) => pex("monthly_budget_usd", Number(e.target.value))} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1" />
          </label>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={!!kn.enabled} onChange={(e) => pkn("enabled", e.target.checked)} />
          <span className="font-semibold text-sm">{t("auto.living_knowledge_nine_strata_part_11")}</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1">{t("auto.cognitive_drawing_with_confidence_novelty_and")}</p>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${kn.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          <label className="rounded border p-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={!!kn.capture_enabled} onChange={(e) => pkn("capture_enabled", e.target.checked)} />
            <span>
              <span className="text-sm font-medium block">{t("auto.knowledge_capture_after_each_session")}</span>
              <span className="text-[11px] text-muted-foreground">{t("auto.no_model_cost_writes_session_summary")}</span>
            </span>
          </label>
          <label className="rounded border p-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={!!kn.recall_enabled} onChange={(e) => pkn("recall_enabled", e.target.checked)} />
            <span>
              <span className="text-sm font-medium block">{t("auto.recall_knowledge_during_planning")}</span>
              <span className="text-[11px] text-muted-foreground">{t("auto.strongest_nodes_only_within_the_same")}</span>
            </span>
          </label>
          <label className="rounded border p-2 block">
            <span className="text-xs text-muted-foreground">{t("auto.recency_days")}</span>
            <input type="number" value={kn.freshness_days ?? 30} onChange={(e) => pkn("freshness_days", Number(e.target.value))} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1" />
          </label>
          <label className="rounded border p-2 block">
            <span className="text-xs text-muted-foreground">{t("auto.minimum_recall_confidence")}</span>
            <input type="number" value={kn.min_confidence ?? 40} onChange={(e) => pkn("min_confidence", Number(e.target.value))} className="w-full border rounded px-2 py-1 bg-background text-sm mt-1" />
          </label>
        </div>
      </div>
    </div>
  );
}
