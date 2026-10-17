import { useEffect, useState } from "react";
import { adminListMaaroofJobs } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";

const T = {
  ar: { title: "المهام الخلفية (آخر 100)", empty: "لا توجد مهام بعد.", goal: "الهدف", status: "الحالة", mode: "الوضع", at: "الوقت", log: "سجل الأحداث", refresh: "تحديث" },
  en: { title: "Background tasks (latest 100)", empty: "No tasks yet.", goal: "Goal", status: "Status", mode: "Mode", at: "Time", log: "Event log", refresh: "Refresh" },
  ku: { title: "ئەرکە پاشبنەماکان (دوایین 100)", empty: "هیچ ئەرکێک نییە.", goal: "ئامانج", status: "دۆخ", mode: "شێواز", at: "کات", log: "تۆماری ڕووداوەکان", refresh: "نوێکردنەوە" },
};

export function JobsAdminPanel() {
  const { lang } = useI18n();
  const c = T[(lang === "en" || lang === "ku" ? lang : "ar") as keyof typeof T];
  const [jobs, setJobs] = useState<any[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [err, setErr] = useState("");

  const load = () => adminListMaaroofJobs({ data: {} }).then((r) => setJobs(r.jobs)).catch((e) => setErr(String(e?.message || e)));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!sel) return;
    adminListMaaroofJobs({ data: { jobId: sel } }).then((r) => setEvents(r.events)).catch(() => setEvents([]));
  }, [sel]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-bold">{c.title}</h2>
          <button onClick={load} className="text-xs text-primary">{c.refresh}</button>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        {jobs.length === 0 ? <p className="text-sm text-muted-foreground">{c.empty}</p> : (
          <ul className="max-h-[600px] space-y-1 overflow-auto">
            {jobs.map((j) => (
              <li key={j.id}>
                <button onClick={() => setSel(j.id)} className={`w-full rounded-lg border p-2 text-start text-xs ${sel === j.id ? "border-primary bg-primary/10" : "border-border"}`}>
                  <div className="line-clamp-1 font-medium">{j.goal || "—"}</div>
                  <div className="mt-1 flex gap-3 text-muted-foreground">
                    <span>{c.status}: {j.status}</span><span>{c.mode}: {j.mode}</span>
                    <span>{new Date(j.created_at).toLocaleString()}</span>
                  </div>
                  {j.error && <div className="mt-1 text-destructive">{j.error}</div>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <h2 className="mb-3 font-display font-bold">{c.log}</h2>
        <ul className="max-h-[600px] space-y-1 overflow-auto text-xs">
          {events.map((e) => (
            <li key={e.id} className="rounded border border-border/60 p-2">
              <div className="flex justify-between"><span className="font-semibold">#{e.seq} {e.event_type}</span><span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span></div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{JSON.stringify(e.payload).slice(0, 800)}</pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
