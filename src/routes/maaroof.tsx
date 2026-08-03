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
import { exportToPDF } from "@/lib/exports";
import { MaaroofStage } from "@/components/maaroof/MaaroofStage";
import { WorkspaceSwitcher, type Workspace } from "@/components/maaroof/WorkspaceSwitcher";
import { SchedulesPanel } from "@/components/maaroof/SchedulesPanel";
import { AgentOps } from "@/components/maaroof/tabs/AgentOps";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { KnowledgeSpaces } from "@/components/agent/KnowledgeSpaces";

const TABS = ["chat", "tasks", "channels", "approvals", "knowledge"] as const;
type TabKey = (typeof TABS)[number];

export const Route = createFileRoute("/maaroof")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (TABS as readonly string[]).includes(String(s.tab)) ? (String(s.tab) as TabKey) : ("chat" as TabKey),
  }),
  head: () => ({
    meta: [
      { title: "معروف — الوكيل الذكي · MAAROOF Ai" },
      { name: "description", content: "Maaroof is the MAAROOF Ai autonomous agent: plans, researches and executes global GEO marketing tasks across 9 AI engines in Arabic, Kurdish and English." },
      { property: "og:title", content: "Maaroof — Autonomous GEO Agent · MAAROOF Ai" },
      { property: "og:description", content: "Plans, researches and executes global GEO marketing tasks across 9 AI engines in AR, KU and EN." },
      { property: "og:url", content: "https://geoiraq.com/maaroof" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/maaroof" }],
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
  const [detected, setDetected] = useState<{ country?: string; city?: string } | null>(null);
  const [geoMode, setGeoMode] = useState<"auto" | "country" | "world">("auto");
  const [country, setCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [executionMode, setExecutionMode] = useState<"simulation" | "recommendation" | "execution">("execution");
  const [typing, setTyping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
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
  }, [user, running, activeWs]);

  async function start() {
    if (!goal.trim() || running || !user) return;
    setRunning(true); setEvents([]);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setRunning(false); return; }
    const ctl = new AbortController(); abortRef.current = ctl;
    try {
      const resp = await fetch("/api/maaroof", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          goal: goal.trim(),
          lang,
          workspace_id: activeWs?.id,
          execution_mode: executionMode,
          geo_scope: geoMode === "auto" ? { mode: "auto" } : geoMode === "world" ? { mode: "world" } : { mode: city ? "city" : "country", country, city: city || undefined },
        }),
        signal: ctl.signal,
      });
      if (!resp.ok || !resp.body) {
        const j: any = await resp.json().catch(() => ({}));
        // Server returns a trilingual message object — show plain readable text,
        // never the raw JSON envelope.
        const readable =
          (j?.message && (j.message[lang] || j.message.ar || j.message.en)) ||
          j?.error ||
          (lang === "en" ? "The request could not be completed." : lang === "ku" ? "داواکاری تەواو نەبوو." : "تعذّر تنفيذ الطلب.");
        setEvents((e) => [...e, { type: "error", data: { message: readable, reason: j?.reason }, t: Date.now() }]);
        setRunning(false); return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() || "";
        for (const p of parts) {
          const lines = p.split("\n");
          let evt = "message"; let data = "";
          for (const ln of lines) {
            if (ln.startsWith("event: ")) evt = ln.slice(7).trim();
            else if (ln.startsWith("data: ")) data += ln.slice(6);
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (evt === "run" && parsed?.geo) setDetected({ country: parsed.geo.country, city: parsed.geo.city });
            setEvents((e) => [...e, { type: evt, data: parsed, t: Date.now() }]);
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setEvents((ev) => [...ev, { type: "error", data: { message: String(e?.message || e) }, t: Date.now() }]);
    } finally { setRunning(false); abortRef.current = null; }
  }

  function stop() { abortRef.current?.abort(); setRunning(false); }

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
      const map: Record<string, string> = { plan: "plan", tool_call: "tool_call", tool_result: "tool_result", reflection: "reflection", assistant: "final" };
      return { type: map[m.role] || "phase", data: m.parts, t: new Date(m.created_at).getTime() };
    });
    setEvents(evs);
  }

  function exportFinal() {
    const text = [...events].reverse().find((e) => e.type === "final")?.data?.text as string | undefined;
    if (!text) return;
    exportToPDF({
      title: t("auto.maaroof_report"),
      lang: "ar",
      sections: [
        { heading: t("auto.target"), kind: "text", text: goal },
        { heading: t("auto.final_answer"), kind: "text", text },
      ],
    });
  }

  if (loading || !user) return (
    <AuthGate
      state={loading ? "loading" : "signed-out"}
      title={t("auto.maaroof_smart_agent")}
      redirect="/maaroof"
    />
  );


  const totalUsd = events.reduce((s, e) => e.type === "done" ? s + (e.data?.totalUsd || 0) : s, 0);
  const stepsCount = events.filter((e) => e.type === "tool_call").length;
  const finalEventText = [...events].reverse().find((e) => e.type === "final")?.data?.text as string | undefined;
  const lastErrorText = [...events].reverse().find((e) => e.type === "error")?.data?.message as string | undefined;
  // Show a readable sentence when a run fails instead of leaving the stage blank.
  const finalText = finalEventText || (lastErrorText ? `⚠️ ${lastErrorText}` : undefined);

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
                  <div className="flex gap-2">
                    {running ? (
                      <button onClick={stop} className="px-4 py-2 rounded bg-destructive text-destructive-foreground flex items-center gap-2"><StopCircle className="w-4 h-4" /> {t("mrf_stop")}</button>
                    ) : (
                      <button onClick={start} disabled={!goal.trim()} className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"><Send className="w-4 h-4" /> {t("mrf_start")}</button>
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
