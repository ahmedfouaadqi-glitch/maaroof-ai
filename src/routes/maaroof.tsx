import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { NAMES as COUNTRY_NAMES } from "@/lib/countries";
const COUNTRIES = Object.entries(COUNTRY_NAMES).map(([code, n]) => ({ code, ar: n.ar, en: n.en }));
import { Loader2, Sparkles, Bot, Globe, StopCircle, Send, History, Brain } from "lucide-react";
import { exportToPDF } from "@/lib/exports";
import { MaaroofStage } from "@/components/maaroof/MaaroofStage";
import { WorkspaceSwitcher, type Workspace } from "@/components/maaroof/WorkspaceSwitcher";
import { SchedulesPanel } from "@/components/maaroof/SchedulesPanel";

export const Route = createFileRoute("/maaroof")({
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
  const [goal, setGoal] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [running, setRunning] = useState(false);
  const [detected, setDetected] = useState<{ country?: string; city?: string } | null>(null);
  const [geoMode, setGeoMode] = useState<"auto" | "country" | "world">("auto");
  const [country, setCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [events]);

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
          geo_scope: geoMode === "auto" ? { mode: "auto" } : geoMode === "world" ? { mode: "world" } : { mode: city ? "city" : "country", country, city: city || undefined },
        }),
        signal: ctl.signal,
      });
      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}));
        setEvents((e) => [...e, { type: "error", data: j, t: Date.now() }]);
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
      title: "تقرير معروف",
      lang: "ar",
      sections: [
        { heading: "الهدف", kind: "text", text: goal },
        { heading: "الإجابة النهائية", kind: "text", text },
      ],
    });
  }

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="max-w-xl mx-auto p-8 text-center">
        <Bot className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h1 className="text-2xl font-bold mb-2">معروف — الوكيل الذكي</h1>
        <p className="mb-4 text-muted-foreground">يرجى تسجيل الدخول لاستخدام معروف.</p>
        <Link to="/auth" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">تسجيل الدخول</Link>
      </div>
    </div>
  );

  const totalUsd = events.reduce((s, e) => e.type === "done" ? s + (e.data?.totalUsd || 0) : s, 0);
  const stepsCount = events.filter((e) => e.type === "tool_call").length;
  const finalText = [...events].reverse().find((e) => e.type === "final")?.data?.text as string | undefined;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="space-y-2">
          <div className="rounded-lg border bg-card p-3">
            <h2 className="flex items-center justify-between gap-2 font-semibold mb-2 text-base">
              <span className="flex items-center gap-2"><History className="w-4 h-4" /> الجلسات السابقة</span>
              <Link to="/maaroof/memory" className="text-xs text-primary hover:underline flex items-center gap-1 font-normal"><Brain className="w-3 h-3" /> الذاكرة</Link>
            </h2>
            <ul className="space-y-1 max-h-[60vh] overflow-y-auto text-sm">
              {runs.length === 0 && <li className="text-muted-foreground text-xs">لا توجد جلسات بعد.</li>}
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
            <div className="flex items-center gap-2 font-bold text-lg"><Sparkles className="w-5 h-5 text-primary" /> معروف</div>
            <span className="text-xs text-muted-foreground">وكيلك الذكي للتسويق الرقمي وGEO حول العالم</span>
            <div className="ms-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span>الخطوات: {stepsCount}</span>
              <span>التكلفة: ${totalUsd.toFixed(4)}</span>
              {running && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>

          {/* Geo bar */}
          <div className="rounded-lg border bg-card p-3 flex items-center gap-2 flex-wrap text-sm">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="font-medium text-sm m-0">النطاق الجغرافي:</h2>
            <select value={geoMode} onChange={(e) => setGeoMode(e.target.value as any)} className="border rounded px-2 py-1 bg-background">
              <option value="auto">تلقائي (حسب IP)</option>
              <option value="country">دولة محددة</option>
              <option value="world">عالمي</option>
            </select>
            {geoMode === "country" && (
              <>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="border rounded px-2 py-1 bg-background">
                  <option value="">— اختر دولة —</option>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.ar} ({c.code})</option>)}
                </select>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="مدينة (اختياري)" className="border rounded px-2 py-1 bg-background w-40" />
              </>
            )}
            {detected?.country && geoMode === "auto" && (
              <span className="text-xs text-muted-foreground">اكتُشف: {detected.city ? `${detected.city}, ` : ""}{detected.country}</span>
            )}
          </div>

          {/* Input */}
          <div className="rounded-lg border bg-card p-3">
            <h2 className="sr-only">إدخال المهمة</h2>
            <textarea
              value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="مرحباً، أنا معروف. ما الهدف؟ (مثال: حلّل ظهور علامتي في السوق السعودي واقترح خطة محتوى لشهر)"
              className="w-full min-h-[80px] p-2 bg-background border rounded outline-none resize-y" disabled={running}
            />
            <div className="flex justify-end gap-2 mt-2">
              {running ? (
                <button onClick={stop} className="px-4 py-2 rounded bg-destructive text-destructive-foreground flex items-center gap-2"><StopCircle className="w-4 h-4" /> إيقاف</button>
              ) : (
                <button onClick={start} disabled={!goal.trim()} className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2"><Send className="w-4 h-4" /> ابدأ</button>
              )}
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
          />
          <div ref={scrollRef} className="hidden" />

        </main>
      </div>
    </div>
  );
}

