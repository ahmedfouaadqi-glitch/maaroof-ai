import { ProgressLine } from "@/components/TrinityPanel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthGate } from "@/components/AuthGate";

import { supabase } from "@/integrations/supabase/client";
import { NAMES as COUNTRY_NAMES } from "@/lib/countries";
const COUNTRIES = Object.entries(COUNTRY_NAMES).map(([code, n]) => ({ code, ar: n.ar, en: n.en }));
import { Loader2, Sparkles, Bot, Globe, StopCircle, Send, History, Brain, ListChecks, Share2, ShieldCheck, GraduationCap } from "lucide-react";
import type { ExportPayload } from "@/lib/exports";
import { ExportButtons } from "@/components/ExportButtons";
import { buildSessionSections, collectSteps } from "@/lib/maaroof/report-sections";
import { getCostPreview, type CostPreview } from "@/lib/tokens.functions";
import { MaaroofStage } from "@/components/maaroof/MaaroofStage";
import { WorkspaceSwitcher, type Workspace } from "@/components/maaroof/WorkspaceSwitcher";
import { SchedulesPanel } from "@/components/maaroof/SchedulesPanel";
import { AgentOps } from "@/components/maaroof/tabs/AgentOps";
import { liveExample } from "@/lib/maaroof/mode-report";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { KnowledgeSpaces } from "@/components/agent/KnowledgeSpaces";

const MODE_HELP = {
  simulation: { ar: "محاكاة: يرسم الوكيل الخطة ويستشير الخبراء ويقدّر النتيجة دون تشغيل أي أداة. مثال: «ماذا يحدث لو نشرت 3 مقالات شهرياً؟». تُخصم كلفة تفكير النماذج من رصيدك.", en: "Simulation: the agent plans, consults experts and estimates the outcome without running tools. Example: “What if I publish 3 articles a month?”. Model reasoning is charged to your balance.", ku: "هاوشێوەکردن: پلان و ڕای پسپۆڕان و خەمڵاندن بەبێ کارپێکردنی ئامراز. تێچووی بیرکردنەوە لە باڵانس دەبڕدرێت." },
  recommendation: { ar: "توصية: تقرير مكتوب بمراحل زمنية حسب المدة التي تذكرها، والأداة المناسبة لكل مرحلة، دون تشغيل الأدوات. مثال: «خطة 3 أشهر لظهور علامتي». يمكنك بعدها بدء التنفيذ بضغطة.", en: "Recommendation: a written report with timed phases matching your stated duration and the right tool per phase, without running tools. Example: “A 3-month plan for my brand”. You can then start execution in one click.", ku: "پێشنیار: ڕاپۆرتێکی نووسراو بە قۆناغی کاتی، بەبێ کارپێکردنی ئامراز. دواتر دەتوانیت جێبەجێکردن دەست پێبکەیت." },
  execution: { ar: "تنفيذ: يشغّل الوكيل الأدوات فعلياً ويجمع نتائج حقيقية قابلة للتصدير. مثال: «افحص ظهور علامتي في النماذج العشرة». كل أداة تُخصم من رصيدك عند نجاحها.", en: "Execution: the agent actually runs the tools and collects real, exportable results. Example: “Check my brand across the 10 models”. Each tool is charged when it succeeds.", ku: "جێبەجێکردن: ئامرازەکان بە ڕاستی کار دەکەن و ئەنجامی ڕاستەقینە کۆدەکەنەوە." },
} as const;

const TABS = ["chat", "tasks", "channels", "approvals", "knowledge"] as const;
type TabKey = (typeof TABS)[number];

export const Route = createFileRoute("/maaroof")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => ({
    tab: (TABS as readonly string[]).includes(String(s.tab)) ? (String(s.tab) as TabKey) : ("chat" as TabKey),
  }),
  head: () => ({
    meta: [
      { title: "معروف — الوكيل الذكي · MAAROOF Ai" },
      { name: "description", content: "Maaroof is the MAAROOF Ai autonomous agent: plans, researches and executes global GEO marketing tasks across 10 AI engines in Arabic, Kurdish and English." },
      { property: "og:title", content: "Maaroof — Autonomous GEO Agent · MAAROOF Ai" },
      { property: "og:description", content: "Plans, researches and executes global GEO marketing tasks across 10 AI engines in AR, KU and EN." },
      { property: "og:url", content: "https://maaroofai.com/maaroof" },
    ],
    links: [{ rel: "canonical", href: "https://maaroofai.com/maaroof" }],
  }),
  component: () => (
    <I18nProvider><AuthProvider><MaaroofPage /></AuthProvider></I18nProvider>
  ),
});

type Event = { type: string; data: any; t: number };
type RunRow = { id: string; goal: string; status: string; started_at: string; total_usd: number };

function MaaroofPage() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const { tab } = Route.useSearch();
  const [goal, setGoal] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [detected, setDetected] = useState<{ country?: string; city?: string } | null>(null);
  const [geoMode, setGeoMode] = useState<"auto" | "country" | "world">("auto");
  const [country, setCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [executionMode, setExecutionMode] = useState<"simulation" | "recommendation" | "execution">("execution");
  const [typing, setTyping] = useState(false);
  const [useSubagents, setUseSubagents] = useState(true);
  const [liveProbe, setLiveProbe] = useState(true);
  const [costRun, setCostRun] = useState<CostPreview | null>(null);
  const [costProbe, setCostProbe] = useState<CostPreview | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pickedSteps, setPickedSteps] = useState<number[]>([]);
  const [techOn, setTechOn] = useState(false);
  const [exportLang, setExportLang] = useState<string>("");
  const [toolPick, setToolPick] = useState<string[] | null>(null);
  const watcherRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [events]);

  function onGoalChange(v: string) {
    setGoal(v);
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1200);
  }


  useEffect(() => {
    if (!user) return;
    (async () => {
      let q = supabase.from("maaroof_runs").select("id, goal, status, started_at, total_usd").order("started_at", { ascending: false }).limit(20);
      if (activeWs) q = q.eq("workspace_id", activeWs.id);
      const { data } = await q;
      setRuns((data as any) || []);
    })();
  }, [user?.id, running, activeWs]);

  useEffect(() => {
    if (!user) return;
    getCostPreview({ data: { toolKey: executionMode === "execution" ? "maaroof" : "maaroof." + executionMode } }).then(setCostRun).catch(() => {});
    getCostPreview({ data: { toolKey: "visibility.probe", units: 10 } }).then(setCostProbe).catch(() => {});
  }, [user?.id, executionMode]);

  async function watchJob(id: string, after: number, token: string) {
    watcherRef.current += 1;
    const watcherId = watcherRef.current;
    let cursor = after;
    while (watcherRef.current === watcherId) {
      const response = await fetch("/api/maaroof-jobs?id=" + encodeURIComponent(id) + "&after=" + cursor, {
        headers: { Authorization: "Bearer " + token }, cache: "no-store",
      });
      if (!response.ok) throw new Error(String((await response.json().catch(() => ({})))?.error || "job_lookup_failed"));
      const body = await response.json();
      const incoming = Array.isArray(body?.events) ? body.events : [];
      if (incoming.length) {
        const mapped = incoming.map((item: any) => ({ type: String(item.event_type || "phase"), data: item.payload || {}, t: item.created_at ? new Date(item.created_at).getTime() : Date.now() }));
        setEvents(current => [...current, ...mapped]);
        cursor = Math.max(cursor, ...incoming.map((item: any) => Number(item.seq) || 0));
        for (const event of mapped) if (event.type === "run" && event.data?.geo) setDetected({ country: event.data.geo.country, city: event.data.geo.city });
      }
      const status = String(body?.job?.status || "running");
      if (status === "completed" || status === "failed" || status === "cancelled") {
        if (status === "failed" || status === "cancelled") setEvents(current => current.some(event => event.type === "error") ? current : [...current, { type: "error", data: { message: status === "failed" ? body?.job?.error || "job_failed" : "cancelled" }, t: Date.now() }]);
        setRunning(false);
        setJobId(id);
        return;
      }
      setRunning(true);
      await new Promise(resolve => setTimeout(resolve, 1800));
    }
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token || !active) return;
      const response = await fetch("/api/maaroof-jobs", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      if (!response.ok || !active) return;
      const body = await response.json();
      const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
      const now = Date.now();
      const recent = jobs.find((job: any) => job.status === "queued" || job.status === "running")
        || jobs.find((job: any) => now - new Date(job.created_at).getTime() < 24 * 60 * 60 * 1000);
      if (!recent || !active) return;
      setJobId(String(recent.id));
      setGoal(String(recent.goal || ""));
      setExecutionMode(["execution", "recommendation", "simulation"].includes(recent.mode) ? recent.mode : "execution");
      const payload = recent.request_payload || {};
      if (payload.detected_geo) setDetected({ country: payload.detected_geo.country, city: payload.detected_geo.city });
      setRunning(recent.status === "queued" || recent.status === "running");
      try { await watchJob(String(recent.id), 0, token); } catch (e: any) { if (active) { setRunning(false); setEvents(current => [...current, { type: "error", data: { message: String(e?.message || e) }, t: Date.now() }]); } }
    })().catch(() => {});
    return () => { active = false; watcherRef.current += 1; };
  }, [user?.id]);

  async function start(clarifications?: Record<string, string>, modeOverride?: "simulation" | "recommendation" | "execution") {
    if (!goal.trim() || running || !user) return;
    const mode = modeOverride || executionMode;
    setRunning(true); setEvents([]); setJobId(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setRunning(false); return; }
    try {
      const resp = await fetch("/api/maaroof", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          goal: goal.trim(),
          lang,
          workspace_id: activeWs?.id,
          execution_mode: mode,
          use_subagents: useSubagents,
          live_probe: liveProbe,
          clarifications,
          geo_scope: geoMode === "auto" ? { mode: "auto" } : geoMode === "world" ? { mode: "world" } : { mode: city ? "city" : "country", country, city: city || undefined },
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.job_id) {
        const readable = body?.message?.[lang] || body?.message?.ar || body?.error || (lang === "en" ? "The request could not be completed." : lang === "ku" ? "داواکاری تەواو نەبوو." : "تعذّر تنفيذ الطلب.");
        throw new Error(String(readable));
      }
      setJobId(String(body.job_id));
      await watchJob(String(body.job_id), 0, token);
    } catch (e: any) {
      setRunning(false);
      const raw = String(e?.message || e);
      const message = raw === "background_queue_not_configured"
        ? (lang === "en" ? "Background processing is not configured yet. Ask the administrator to provision the job queue." : lang === "ku" ? "سیستەمی کاری پشتەوە هێشتا ڕێکنەخراوە؛ پەیوەندی بە ئەدمینەوە بکە." : "لم يتم إعداد طابور المهام الخلفية بعد. يرجى إبلاغ الإدارة بإعداده.")
        : raw === "background_jobs_migration_required"
          ? (lang === "en" ? "Background-job database migration is required before tasks can run." : lang === "ku" ? "پێویستە مایگرەیشنی بنکەدراوەی ئەرکەکان جێبەجێ بکرێت." : "يلزم تطبيق ترحيل قاعدة بيانات المهام الخلفية قبل التشغيل.")
          : raw;
      setEvents(current => [...current, { type: "error", data: { message }, t: Date.now() }]);
    }
  }

  async function stop() {
    if (!jobId) { setRunning(false); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("auth_required");
      await fetch("/api/maaroof-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ job_id: jobId }),
      });
    } catch (e: any) {
      setEvents(current => [...current, { type: "error", data: { message: String(e?.message || e) }, t: Date.now() }]);
    }
  }

  async function loadRun(runId: string) {
    if (running) return;
    setEvents([{ type: "phase", data: { phase: "loading_history" }, t: Date.now() }]);
    const { data: run } = await supabase.from("maaroof_runs").select("goal, plan, detected_geo").eq("id", runId).maybeSingle();
    if (run) {
      setGoal((run as any).goal || "");
      const dg = (run as any).detected_geo; if (dg) setDetected({ country: dg.country, city: dg.city });
    }
    const { data: msgs } = await supabase.from("maaroof_messages").select("role, parts, created_at").eq("run_id", runId).order("created_at");
    const evs: Event[] = ((msgs as any[]) || []).map((m) => {
      const map: Record<string, string> = { plan: "plan", tool_call: "tool_call", tool_result: "tool_result", reflection: "reflection", assistant: "final", council: "council", clarify: "clarify" };
      return { type: map[m.role] || "phase", data: m.parts, t: new Date(m.created_at).getTime() };
    });
    setEvents(evs);
  }

  /** Full session report: readable sections; technical data only when chosen. */
  function buildReport(): ExportPayload {
    const steps = pickedSteps.length ? pickedSteps : undefined;
    return {
      title: t("auto.maaroof_report"),
      lang: (exportLang || lang) as any,
      sections: buildSessionSections({ events, lang: exportLang || lang, goal, finalText: finalEventText, selection: { steps, includeTechnical: techOn } }),
    };
  }
  function exportFinal() { /* kept for the stage button; full export lives in ExportButtons below */ }

  if (loading || !user) return (
    <AuthGate
      state={loading ? "loading" : "signed-out"}
      title={t("auto.maaroof_smart_agent")}
      redirect="/maaroof"
    />
  );


  const totalUsd = events.reduce((s, e) => e.type === "done" ? s + (e.data?.totalUsd || 0) : s, 0);
  const stepsCount = events.filter((e) => e.type === "tool_call").length;
  const clarifyEvents = events.filter((e) => e.type === "clarify");
  const reusedAnswers = (events.find((e) => e.type === "reused_answers")?.data?.answers || null) as Record<string, string> | null;
  const finalEventText = [...events].reverse().find((e) => e.type === "final")?.data?.text as string | undefined;
  const sessionSteps = collectSteps(events).filter((x) => x.ok);
  const lastErrorText = [...events].reverse().find((e) => e.type === "error")?.data?.message as string | undefined;
  // Show a readable sentence when a run fails instead of leaving the stage blank.
  const finalText = finalEventText || (lastErrorText ? `⚠️ ${lastErrorText}` : undefined);
  const finalMode = [...events].reverse().find((e) => e.type === "final")?.data?.mode as string | undefined;
  const rawPlan = [...events].reverse().find((e) => e.type === "plan_raw")?.data?.plan;
  const catalog = [...events].reverse().find((e) => e.type === "tool_catalog")?.data as { balance: number | null; tools: { key: string; label: any; selected: boolean; reason: string | null; cost: number }[] } | undefined;
  const picked = toolPick ?? (catalog?.tools.filter((x) => x.selected).map((x) => x.key) || []);
  const pickedCost = (catalog?.tools || []).filter((x) => picked.includes(x.key)).reduce((a, x) => a + (x.cost || 0), 0);

  const TAB_META: Record<TabKey, { icon: typeof Sparkles; label: string }> = {
    chat: { icon: Sparkles, label: t("mrf_tab_chat") },
    tasks: { icon: ListChecks, label: t("mrf_tab_tasks") },
    channels: { icon: Share2, label: t("mrf_tab_channels") },
    approvals: { icon: ShieldCheck, label: t("mrf_tab_approvals") },
    knowledge: { icon: GraduationCap, label: t("mrf_tab_knowledge") },
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar — shared context across every tab */}
        <aside className="space-y-3">
          <WorkspaceSwitcher onChange={setActiveWs} />

          <div className="rounded-lg border bg-card p-3">
            <h2 className="flex items-center justify-between gap-2 font-semibold mb-2 text-base">
              <span className="flex items-center gap-2"><History className="w-4 h-4" /> {t("mrf_sessions")}</span>
              <Link to="/maaroof/memory" className="text-xs text-primary hover:underline flex items-center gap-1 font-normal"><Brain className="w-3 h-3" /> {t("auto.memory")}</Link>
            </h2>
            <ul className="space-y-1 max-h-[40vh] overflow-y-auto text-sm">
              {runs.length === 0 && <li className="text-muted-foreground text-xs">{t("mrf_no_sessions")}</li>}
              {runs.map((r) => (
                <li key={r.id}>
                  <button onClick={() => loadRun(r.id)} className="w-full text-start p-2 rounded hover:bg-muted">
                    <div className="line-clamp-2">{r.goal}</div>
                    <div className="text-[10px] text-muted-foreground flex justify-between mt-1">
                      <span>{r.status}</span><span>${Number(r.total_usd).toFixed(4)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <main className="space-y-3">
          {/* Header */}
          <div className="rounded-lg border bg-card p-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-lg"><Sparkles className="w-5 h-5 text-primary" /> {t("auto.maaroof_2")}</div>
            <span className="text-xs text-muted-foreground">{t("auto.your_smart_agent_for_digital_marketing")}</span>
            {activeWs && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary">
                {activeWs.name}
              </span>
            )}
            {(() => {
              const agentEvt = [...events].reverse().find((e) => e.type === "agent");
              if (!agentEvt) return null;
              const a = agentEvt.data as any;
              return (
                <span
                  title={a.reused ? "Warm agent reused" : "New agent"}
                  className="text-xs px-2 py-0.5 rounded-full bg-accent/10 border border-accent/40 text-accent flex items-center gap-1"
                >
                  <Bot className="w-3 h-3" />
                  {a.role} · v{a.version}
                  {a.reused && <span className="opacity-70">· warm</span>}
                  {typeof a.success_rate === "number" && (
                    <span className="opacity-70">· {(a.success_rate * 100).toFixed(0)}%</span>
                  )}
                </span>
              );
            })()}
            <div className="ms-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span>{t("mrf_steps")}: {stepsCount}</span>
              <span>{t("mrf_cost")}: ${totalUsd.toFixed(4)}</span>
              {running && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>

          {/* Unified tab bar */}
          <nav className="rounded-lg border bg-card p-1 flex flex-wrap gap-1" aria-label={t("mrf_tabs_aria")}>
            {TABS.map((k) => {
              const Icon = TAB_META[k].icon;
              const active = tab === k;
              return (
                <Link
                  key={k}
                  to="/maaroof"
                  search={{ tab: k }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    active ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="w-3.5 h-3.5" /> {TAB_META[k].label}
                </Link>
              );
            })}
          </nav>

          {tab === "chat" && (
            <>
              {/* Geo bar */}
              <div className="rounded-lg border bg-card p-3 flex items-center gap-2 flex-wrap text-sm">
                <Globe className="w-4 h-4 text-primary" />
                <h2 className="font-medium text-sm m-0">{t("auto.geographic_scope_2")}</h2>
                <label htmlFor="geo-mode" className="sr-only">{t("auto.geographic_scope_geographic_scope")}</label>
                <select id="geo-mode" aria-label={t("auto.geographic_scope_geographic_scope")} value={geoMode} onChange={(e) => setGeoMode(e.target.value as any)} className="border rounded px-2 py-1 bg-background">
                  <option value="auto">{t("auto.automatic_by_ip")}</option>
                  <option value="country">{t("auto.specific_country")}</option>
                  <option value="world">{t("auto.global")}</option>
                </select>
                {geoMode === "country" && (
                  <>
                    <label htmlFor="geo-country" className="sr-only">{t("auto.state_country")}</label>
                    <select id="geo-country" aria-label={t("auto.state_country")} value={country} onChange={(e) => setCountry(e.target.value)} className="border rounded px-2 py-1 bg-background">
                      <option value="">{t("auto.select_a_country")}</option>
                      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{lang === "en" ? c.en : c.ar} ({c.code})</option>)}
                    </select>
                    <label htmlFor="geo-city" className="sr-only">{t("auto.city")}</label>
                    <input id="geo-city" aria-label={t("auto.city")} value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("auto.city_optional")} className="border rounded px-2 py-1 bg-background w-40" />
                  </>
                )}
                {detected?.country && geoMode === "auto" && (
                  <span className="text-xs text-muted-foreground">{t("mrf_detected")}: {detected.city ? `${detected.city}, ` : ""}{detected.country}</span>
                )}
              </div>

              {/* Input */}
              <div className="rounded-lg border bg-card p-3">
                <h2 className="sr-only">{t("auto.enter_task")}</h2>
                <textarea
                  value={goal} onChange={(e) => onGoalChange(e.target.value)}
                  placeholder={t("auto.hello_i_am_maaroof_what_is")}
                  className="w-full min-h-[80px] p-2 bg-background border rounded outline-none resize-y" disabled={running}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <div className="inline-flex rounded-lg border overflow-hidden text-xs" role="group" aria-label={t("auto.execution_style")}>
                    {([
                      { key: "simulation", label: t("auto.simulation_2") },
                      { key: "recommendation", label: t("auto.recommendation") },
                      { key: "execution", label: t("auto.execute") },
                    ] as const).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        disabled={running}
                        onClick={() => setExecutionMode(m.key)}
                        className={`px-3 py-1.5 transition ${executionMode === m.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                        aria-pressed={executionMode === m.key}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={useSubagents} disabled={running} onChange={(e) => setUseSubagents(e.target.checked)} />
                      <span>{lang === "en" ? "Specialised sub-agents — deeper advice from expert agents; off = faster and cheaper" : lang === "ku" ? "بریکاری پسپۆڕ — ڕاوێژی قووڵتر؛ ناچالاک = خێراتر و هەرزانتر" : "الوكلاء المتخصصون — رأي أعمق من وكلاء خبراء؛ الإيقاف = أسرع وأقل كلفة"}</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={liveProbe} disabled={running} onChange={(e) => setLiveProbe(e.target.checked)} />
                      <span>{lang === "en" ? "Ask the 10 AI models live — real answers, uses extra balance; off = estimate only" : lang === "ku" ? "پرسیاری ڕاستەوخۆ لە 10 مۆدێل — وەڵامی ڕاستەقینە، باڵانسی زیاتر" : "سؤال النماذج العشرة فعلياً — إجابات حقيقية وتستهلك رصيداً إضافياً؛ الإيقاف = تقدير فقط"}</span></label>
                  </div>
                  <p className="basis-full text-xs text-muted-foreground">{MODE_HELP[executionMode][lang === "en" ? "en" : lang === "ku" ? "ku" : "ar"]}{(() => { const ex = liveExample(executionMode, { country: geoMode === "country" ? country : detected?.country, lastGoal: undefined }, lang === "en" ? "en" : lang === "ku" ? "ku" : "ar"); return ex ? <span className="block mt-1 text-foreground/80">{ex}</span> : null; })()}</p>
                  {costRun?.metered && (
                    <div className="text-xs text-muted-foreground">
                      {lang === "en" ? "Expected cost" : lang === "ku" ? "تێچووی چاوەڕوانکراو" : "الكلفة المتوقعة"}: {costRun.total}{liveProbe && costProbe ? ` + ${costProbe.total} (${lang === "en" ? "10 models live" : "سؤال 10 نماذج"})` : ""} · {lang === "en" ? "Your balance" : lang === "ku" ? "باڵانسەکەت" : "رصيدك"}: {costRun.balance}
                      {costRun.balance < costRun.total + (liveProbe && costProbe ? costProbe.total : 0) && <span className="text-destructive"> — {lang === "en" ? "not enough balance" : "الرصيد غير كافٍ"}</span>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {running ? (
                      <button onClick={stop} className="px-4 py-2 rounded bg-destructive text-destructive-foreground flex items-center gap-2"><StopCircle className="w-4 h-4" /> {t("mrf_stop")}</button>
                    ) : (
                      <button onClick={() => start()} disabled={!goal.trim()} className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"><Send className="w-4 h-4" /> {t("mrf_start")}</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Stage */}
              <MaaroofStage
                events={events}
                running={running}
                geoMode={geoMode}
                country={country}
                detected={detected}
                finalText={finalText}
                onExport={exportFinal}
                onPickCountry={(code) => { setGeoMode("country"); setCountry(code); }}
                typing={typing}
              />
              {reusedAnswers && (
                <div className="mt-3 rounded-lg border bg-muted/40 px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <span>{lang === "en" ? "We used your previous answer: " : lang === "ku" ? "وەڵامی پێشووت بەکارهات: " : "استخدمنا إجابتك السابقة: "}{Object.values(reusedAnswers).join("، ")}</span>
                  {!running && <button className="text-primary underline" onClick={() => { const k = Object.keys(reusedAnswers)[0]; const v = window.prompt(lang === "en" ? "Edit your answer" : "عدّل إجابتك", reusedAnswers[k]); if (v != null && v.trim()) start({ [k]: v.trim() }); }}>{lang === "en" ? "Edit" : lang === "ku" ? "دەستکاری" : "تعديل"}</button>}
                </div>
              )}
              {!running && finalMode && <div className="mt-3"><ProgressLine userId={user?.id} lang={(lang as any) || "ar"} /></div>}
              {!running && (finalMode === "recommendation" || finalMode === "simulation") && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {catalog && (
                    <div className="w-full rounded-lg border bg-card p-3 text-xs space-y-2">
                      <div className="font-semibold text-sm">{lang === "en" ? "Tools for this plan — add or remove before running" : lang === "ku" ? "ئامرازەکان — زیاد یان لاببە پێش جێبەجێکردن" : "أدوات هذه الخطة — أضف أو أزل قبل التنفيذ"}</div>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {catalog.tools.map((x) => (
                          <label key={x.key} className={`flex items-start gap-2 rounded border p-2 cursor-pointer ${picked.includes(x.key) ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                            <input type="checkbox" className="mt-0.5" checked={picked.includes(x.key)} onChange={(ev) => setToolPick(ev.target.checked ? [...picked, x.key] : picked.filter((k) => k !== x.key))} />
                            <span className="flex-1">
                              <span className="font-medium">{x.label?.[lang] || x.label?.ar || x.key}</span>
                              <span className="text-muted-foreground"> · {x.cost} {lang === "en" ? "tokens" : "توكن"}</span>
                              <span className="block text-muted-foreground">{x.selected ? (x.reason || "") : (lang === "en" ? "Not chosen by the agent for this goal." : lang === "ku" ? "بۆ ئەم ئامانجە هەڵنەبژێردرا." : "لم يخترها الوكيل لهذا الهدف.")}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 font-medium">
                        <span>{lang === "en" ? "Total" : "المجموع"}: {pickedCost}</span>
                        {catalog.balance != null && <span>{lang === "en" ? "Balance after" : "رصيدك بعد التنفيذ"}: {catalog.balance - pickedCost}</span>}
                        {catalog.balance != null && catalog.balance < pickedCost && <span className="text-destructive">{lang === "en" ? "Not enough balance — remove a tool or top up." : "الرصيد لا يكفي — أزل أداة أو اشحن رصيدك."}</span>}
                      </div>
                    </div>
                  )}
                  <button disabled={!!catalog && catalog.balance != null && catalog.balance < pickedCost} onClick={() => { setExecutionMode("execution"); start(catalog ? { tools: picked.join(",") } : undefined, "execution"); }} className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm">
                    {lang === "en" ? "Start executing this plan" : lang === "ku" ? "دەستپێکردنی جێبەجێکردنی ئەم پلانە" : "بدء تنفيذ هذه الخطة"}
                  </button>
                  {rawPlan && (
                    <details className="text-xs w-full">
                      <summary className="cursor-pointer text-muted-foreground">{lang === "en" ? "Show technical details of the steps" : lang === "ku" ? "وردەکاری تەکنیکی" : "عرض التفاصيل التقنية للخطوات"}</summary>
                      <pre dir="ltr" className="mt-2 max-h-64 overflow-auto rounded border bg-muted p-2 text-left">{JSON.stringify(rawPlan, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
              {clarifyEvents.length > 0 && !running && (
                <div className="mt-4 rounded-lg border border-primary/40 bg-card p-4 space-y-3">
                  <div className="text-sm font-semibold">{lang === "en" ? "Maaroof needs a quick answer to continue" : lang === "ku" ? "ماعروف پێویستی بە وەڵامێکی خێرایە" : "يحتاج معروف إلى إجابة سريعة ليكمل"}</div>
                  {clarifyEvents.map((e, i) => (
                    <label key={i} className="block text-sm">
                      <span className="text-muted-foreground">{String(e.data?.question || "")}</span>
                      <input value={answers[e.data?.field] || ""} onChange={(ev) => setAnswers((a) => ({ ...a, [e.data?.field]: ev.target.value }))} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5" />
                    </label>
                  ))}
                  <button onClick={() => { const c = { ...answers }; if (c.brand_name || c.company || c.business_name || c.project_name) c.brand = c.brand || c.brand_name || c.company || c.business_name || c.project_name; start(c); }} className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm">{lang === "en" ? "Continue with my answer" : lang === "ku" ? "بەردەوام بە" : "أكمل بإجابتي"}</button>
                </div>
              )}
              {events.length > 0 && !running && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{lang === "en" ? "Full session report:" : "التقرير الكامل للجلسة:"}</span>
                  <ExportButtons toolKey="maaroof" size="xs" build={buildReport} />
                </div>
              )}
              {events.length > 0 && !running && sessionSteps.length > 0 && (
                <div className="mt-2 rounded-lg border bg-card/60 p-3 text-xs space-y-2">
                  <div className="font-semibold">{lang === "en" ? "Choose what to export (none selected = everything)" : lang === "ku" ? "هەڵبژێرە چی هەناردە بکەیت" : "اختر ما تريد تصديره (بدون اختيار = الكل)"}</div>
                  <div className="flex flex-wrap gap-2">
                    {sessionSteps.map((s) => (
                      <label key={s.index} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 cursor-pointer">
                        <input type="checkbox" checked={pickedSteps.includes(s.index)} onChange={(e) => setPickedSteps((p) => e.target.checked ? [...p, s.index] : p.filter((x) => x !== s.index))} />
                        <span>{s.index + 1}. {s.tool}</span>
                      </label>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={techOn} onChange={(e) => setTechOn(e.target.checked)} />
                    <span>{lang === "en" ? "Include technical details (optional)" : lang === "ku" ? "وردەکاری تەکنیکی" : "تضمين التفاصيل التقنية (اختياري)"}</span>
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <span>{lang === "en" ? "Export language" : lang === "ku" ? "زمانی هەناردە" : "لغة التصدير"}</span>
                    <select value={exportLang || lang} onChange={(e) => setExportLang(e.target.value)} className="rounded border border-border bg-background px-1 py-0.5">
                      <option value="ar">العربية</option><option value="en">English</option><option value="ku">کوردی</option>
                    </select>
                    <span className="text-muted-foreground">{lang === "en" ? "(headings switch free; results keep the language they were generated in)" : "(العناوين تتحول مجاناً؛ النتائج تبقى بلغة توليدها)"}</span>
                  </label>
                </div>
              )}
              <div ref={scrollRef} className="hidden" />
            </>
          )}

          {tab === "tasks" && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-4 text-xs text-muted-foreground">{t("mrf_tab_tasks_hint")}</p>
              <AgentOps section="tasks" />
            </div>
          )}

          {tab === "channels" && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="mb-2 text-xs text-muted-foreground">{t("mrf_tab_channels_hint")}</p>
                <AgentOps section="channels" />
              </div>
              <SchedulesPanel workspaceId={activeWs?.id ?? null} defaultPrompt={goal} />
            </div>
          )}

          {tab === "approvals" && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-xs text-muted-foreground">{t("mrf_tab_approvals_hint")}</p>
              <ApprovalQueue />
            </div>
          )}

          {tab === "knowledge" && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-xs text-muted-foreground">{t("mrf_tab_knowledge_hint")}</p>
              <KnowledgeSpaces userId={user?.id ?? null} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
