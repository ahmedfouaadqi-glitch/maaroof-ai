import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { NAMES as COUNTRY_NAMES } from "@/lib/countries";
const COUNTRIES = Object.entries(COUNTRY_NAMES).map(([code, n]) => ({ code, ar: n.ar, en: n.en }));
import { Loader2, Sparkles, Bot, Globe, StopCircle, Send, History } from "lucide-react";

export const Route = createFileRoute("/maaroof")({
  head: () => ({ meta: [{ title: "معروف — الوكيل الذكي" }, { name: "description", content: "Maaroof: a Manus+Kimi-style intelligent agent for global GEO marketing." }] }),
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
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [events]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("maaroof_runs").select("id, goal, status, started_at, total_usd").order("started_at", { ascending: false }).limit(20);
      setRuns((data as any) || []);
    })();
  }, [user, running]);

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
            <div className="flex items-center gap-2 font-semibold mb-2"><History className="w-4 h-4" /> الجلسات السابقة</div>
            <ul className="space-y-1 max-h-[60vh] overflow-y-auto text-sm">
              {runs.length === 0 && <li className="text-muted-foreground text-xs">لا توجد جلسات بعد.</li>}
              {runs.map((r) => (
                <li key={r.id} className="p-2 rounded hover:bg-muted">
                  <div className="line-clamp-2">{r.goal}</div>
                  <div className="text-[10px] text-muted-foreground flex justify-between mt-1">
                    <span>{r.status}</span><span>${Number(r.total_usd).toFixed(4)}</span>
                  </div>
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
            <span className="font-medium">النطاق الجغرافي:</span>
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

          {/* Stream */}
          <div ref={scrollRef} className="rounded-lg border bg-card p-3 max-h-[60vh] overflow-y-auto space-y-2">
            {events.length === 0 && !running && (
              <div className="text-center text-muted-foreground py-12">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>مرحباً، أنا <strong>معروف</strong>. حدّد هدفك وسأخطّط وأنفّذ.</p>
              </div>
            )}
            {events.map((e, i) => <EventCard key={i} ev={e} />)}
            {finalText && (
              <div className="border-t pt-3 mt-3">
                <div className="text-xs font-semibold text-primary mb-1">الإجابة النهائية</div>
                <div className="whitespace-pre-wrap text-sm">{finalText}</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function EventCard({ ev }: { ev: Event }) {
  const colors: Record<string, string> = {
    plan: "border-blue-500/30 bg-blue-500/5",
    tool_call: "border-amber-500/30 bg-amber-500/5",
    tool_result: "border-green-500/30 bg-green-500/5",
    reflection: "border-purple-500/30 bg-purple-500/5",
    error: "border-destructive/40 bg-destructive/5",
    memory: "border-muted bg-muted/40",
    phase: "border-muted bg-muted/30",
    final: "hidden",
    done: "hidden",
    run: "hidden",
  };
  const labels: Record<string, string> = {
    plan: "📋 الخطة", tool_call: "🔧 استدعاء أداة", tool_result: "✅ نتيجة الأداة",
    reflection: "🤔 تأمل", memory: "🧠 ذاكرة", phase: "⏳ مرحلة", error: "❌ خطأ",
  };
  if (colors[ev.type] === "hidden") return null;
  return (
    <details open={ev.type !== "tool_result"} className={`border rounded p-2 text-xs ${colors[ev.type] || "border-muted"}`}>
      <summary className="cursor-pointer font-semibold">{labels[ev.type] || ev.type}</summary>
      <pre className="mt-2 whitespace-pre-wrap overflow-x-auto text-[11px]">{JSON.stringify(ev.data, null, 2).slice(0, 2000)}</pre>
    </details>
  );
}
