// "Account pulse": the real deep audit shown inside the workspace as a ring + link map.
// Reuses /api/deep-audit (estimate/start) and /api/maaroof-jobs (progress/cancel). No new charging path.
import { useEffect, useRef, useState } from "react";
import { Activity, Loader2, X, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ExportButtons } from "@/components/ExportButtons";

type L = "ar" | "en" | "ku";
const T = {
  ar: { title: "نبض حسابك", sub: "فحص عميق لروابط العميل المتعددة وتوجيهها عبر خمسة محاور", start: "افحص الآن", confirm: "موافق، ابدأ", cancel: "إلغاء", stop: "أوقف الفحص", est: "الكلفة التقديرية", bal: "رصيدك", running: "يقرأ روابطك في الخلفية…", none: "لم يُفحص حسابك بعد", nolinks: "أضف روابط موقعك وحساباتك في ملفك الشخصي لتفعيل النبض.", workspaceNolinks: "أضف موقع العميل وروابطه العامة من المقابلة ← حساب مساحة العمل.", unpriced: "الفحص غير مسعّر لحسابك بعد.", cancelled: "أُلغي الفحص", partial: "قُرئ جزء من الروابط فقط", failed: "تعذّر الفحص؛ لم يُخصم شيء", task: "حوّلها إلى مهمة", delta: "منذ الفحص السابق", un: "لم يُقَس" },
  en: { title: "Account pulse", sub: "A deep audit of up to 50 client links, routed across five axes", start: "Scan now", confirm: "Approve & start", cancel: "Cancel", stop: "Stop scan", est: "Estimated cost", bal: "Balance", running: "Reading your links in the background…", none: "Your account hasn't been scanned yet", nolinks: "Add your site and social links in your profile to enable the pulse.", workspaceNolinks: "Add this client's website and public links in Interview → Workspace account.", unpriced: "The audit isn't priced for your account yet.", cancelled: "Scan cancelled", partial: "Only some links could be read", failed: "Scan failed; nothing was charged", task: "Turn into a task", delta: "since last scan", un: "Unmeasured" },
  ku: { title: "لێدانی هەژمارەکەت", sub: "پشکنینی قووڵی ڕاستەقینە بۆ ماڵپەڕ و تۆڕەکانت", start: "ئێستا بپشکنە", confirm: "ڕازیم، دەست پێبکە", cancel: "هەڵوەشاندنەوە", stop: "ڕاگرتن", est: "تێچووی خەمڵێنراو", bal: "باڵانس", running: "بەستەرەکانت دەخوێنرێنەوە…", none: "هێشتا نەپشکنراوە", nolinks: "بەستەرەکانت لە پرۆفایلدا زیاد بکە.", workspaceNolinks: "ماڵپەڕ و بەستەرە گشتییەکانی ئەم کڕیارە زیاد بکە.", unpriced: "نرخ دانەنراوە.", cancelled: "هەڵوەشێنرایەوە", partial: "تەنها هەندێک بەستەر خوێنرایەوە", failed: "سەرنەکەوت؛ هیچ نەبڕدرا", task: "بیکە بە ئەرک", delta: "لە پشکنینی پێشوو", un: "نەپێوراو" },
};
const AX = ["seo", "aeo", "geo", "sge", "gseo"] as const;
const TASK: Record<L, (axis: string, url: string) => string> = {
  ar: (a, u) => `حسّن محور ${a.toUpperCase()} في ${u} بناءً على نتيجة الفحص العميق`,
  en: (a, u) => `Improve the ${a.toUpperCase()} axis on ${u} based on the deep audit result`,
  ku: (a, u) => `تەوەری ${a.toUpperCase()} لە ${u} باشتر بکە بەپێی ئەنجامی پشکنین`,
};

async function authed(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const tok = data.session?.access_token;
  return fetch(path, { ...init, headers: { ...(init.headers || {}), "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) } });
}

export const tone = (s: number | null | undefined) => s == null ? "text-muted-foreground" : s >= 70 ? "text-primary font-bold" : s >= 40 ? "text-warning font-bold" : "text-destructive font-bold";
const VERDICT: Record<L, [string, string, string, string]> = {
  ar: ["جيد", "ضعيف", "مفقود", "لم يُقَس"],
  en: ["Good", "Weak", "Missing", "Unmeasured"],
  ku: ["باش", "لاواز", "نییە", "نەپێوراو"],
};
const verdict = (lang: L, s: number | null | undefined) => { const v = VERDICT[lang]; return s == null ? v[3] : s >= 70 ? v[0] : s >= 40 ? v[1] : v[2]; };
const NOTE: Record<L, string> = { ar: "النتيجة تعكس الموقع المنشور بتاريخ الفحص", en: "The result reflects the published site at scan time", ku: "ئەنجامەکە ماڵپەڕی بڵاوکراوە لە کاتی پشکنیندا پیشان دەدات" };

function Ring({ value, size = 92 }: { value: number | null; size?: number }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r, v = value ?? 0;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} className="stroke-muted" strokeWidth={7} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} className="stroke-primary transition-all duration-700" strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} />
    </svg>
  );
}

export function WorkspaceAuditPulse({ lang, workspaceId, onTask }: { lang: L; workspaceId: string | null; onTask: (text: string) => void }) {
  const t = T[lang];
  const scopeQuery = new URLSearchParams({ workspace_id: workspaceId ?? "" }).toString();
  const [est, setEst] = useState<any>(null);
  const [ask, setAsk] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [live, setLive] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const after = useRef(0);

  useEffect(() => {
    let active = true;
    setEst(null); setJobId(null); setStatus(""); setLive({}); setResult(null); setOpen(null);
    setLoadError(false); after.current = 0;
    (async () => {
      const r = await authed("/api/deep-audit?" + scopeQuery).catch(() => null);
      if (!active) return;
      if (!r?.ok) { setLoadError(true); return; }
      const j = await r.json();
      if (!active) return;
      setEst(j);
      if (j.last?.id) { after.current = 0; setJobId(j.last.id); setStatus(String(j.last.status || "")); }
    })().catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [scopeQuery]);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      const query = new URLSearchParams({ id: jobId, after: String(after.current), workspace_id: workspaceId ?? "" });
      const r = await authed("/api/maaroof-jobs?" + query.toString()).catch(() => null);
      if (!r?.ok || stop) return;
      const j = await r.json();
      setStatus(j.job.status);
      for (const e of j.events || []) {
        after.current = Math.max(after.current, e.seq);
        if (e.event_type === "audit_target") setLive((m) => ({ ...m, [e.payload.url]: e.payload }));
        if (e.event_type === "audit_result") setResult(e.payload);
      }
      if (!stop && (j.job.status === "running" || j.job.status === "queued")) setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [jobId, scopeQuery]);

  async function start() {
    setAsk(false); setResult(null); setLive({});
    const r = await authed("/api/deep-audit", { method: "POST", body: JSON.stringify({ approved: true, workspace_id: workspaceId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setStatus("failed"); return; }
    after.current = 0; setStatus("running"); setJobId(j.job_id);
  }
  async function cancel() {
    if (!jobId) return;
    await authed("/api/maaroof-jobs", { method: "POST", body: JSON.stringify({ job_id: jobId, workspace_id: workspaceId }) }).catch(() => null);
    setStatus("cancelled");
  }

  if (!est) return loadError ? <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{t.failed}</p> : null;
  const running = status === "running" || status === "queued";
  const targets: any[] = est.targets || [];
  const prev = est.previous?.overall ?? null;
  const delta = result?.overall != null && prev != null ? result.overall - prev : null;

  return (
    <div className="rounded-2xl border border-primary/25 bg-card p-4 md:p-5">
      <div className="flex items-center gap-2"><Activity className={`size-4 text-primary ${running ? "animate-pulse" : ""}`} /><h2 className="font-semibold">{t.title}</h2></div>
      <p className="mt-1 text-xs text-muted-foreground">{t.sub}</p>

      {!targets.length ? <p className="mt-3 text-xs text-muted-foreground">{workspaceId ? t.workspaceNolinks : t.nolinks}</p> : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <Ring value={result?.overall ?? null} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{result?.overall ?? "—"}</span>
                {delta != null && <span className={`text-[10px] ${delta >= 0 ? "text-primary" : "text-destructive"}`}>{delta >= 0 ? "+" : ""}{delta}</span>}
              </div>
            </div>
            <div className="grid flex-1 grid-cols-5 gap-1 text-center text-[11px]">
              {AX.map((a) => { const v = result?.axes?.[a]; return (
                <div key={a} className="rounded-lg bg-muted/60 p-1.5"><div className="font-semibold">{a.toUpperCase()}</div><div className={`text-sm ${tone(v)}`}>{v ?? "—"}</div>
                  {result && <div className="text-[9px] text-muted-foreground">{verdict(lang, v)}</div>}
                  <div className="mt-1 h-1 overflow-hidden rounded bg-background"><div className="h-full bg-primary transition-all duration-700" style={{ width: `${v ?? 0}%` }} /></div></div>
              ); })}
            </div>
          </div>
          {delta != null && <p className="mt-1 text-[11px] text-muted-foreground">{delta >= 0 ? "+" : ""}{delta} {t.delta}</p>}
          {result && <p className="mt-1 text-[11px] text-muted-foreground">{NOTE[lang]}</p>}
          {result && <div className="mt-2 flex justify-end"><ExportButtons size="xs" toolKey="maaroof" build={() => ({ title: t.title, lang, entity: { brand: targets[0]?.url ? new URL(targets[0].url).hostname : "Maaroof audit", site: targets[0]?.url, links: targets.map((x: any) => x.url) }, sections: [
            { heading: lang === "en" ? "Five-axis summary" : lang === "ku" ? "پوختەی پێنج تەوەر" : "ملخص المحاور الخمسة", kind: "kv", rows: [["SEO", result.axes?.seo ?? "unmeasured"], ["AEO", result.axes?.aeo ?? "unmeasured"], ["GEO", result.axes?.geo ?? "unmeasured"], ["SGE", result.axes?.sge ?? "unmeasured"], ["GSEO", result.axes?.gseo ?? "unmeasured"], [lang === "en" ? "Overall" : lang === "ku" ? "گشتی" : "الإجمالي", result.overall ?? "unmeasured"]] },
            { heading: lang === "en" ? "Audited targets and evidence" : lang === "ku" ? "ئامانج و بەڵگە پشکنراوەکان" : "الأهداف والأدلة المفحوصة", kind: "text", text: JSON.stringify((result.targets || []).map((x: any) => ({ url: x.url, ok: x.ok, findings: (x.findings || []).map((f: any) => ({ axis: f.axis, score: f.score, evidence: f.evidence })) })), null, 2) },
          ] })} /></div>}

          <ul className="mt-4 space-y-1.5" dir="ltr">
            {targets.map((tg) => {
              const done = result?.targets?.find((x: any) => x.url === tg.url) || live[tg.url];
              const sc = done ? Math.round((done.findings.filter((f: any) => f.score != null).reduce((s: number, f: any) => s + f.score, 0) / Math.max(1, done.findings.filter((f: any) => f.score != null).length)) || 0) : null;
              const dot = !done ? (running ? "bg-primary/40 animate-pulse" : "bg-muted-foreground/30") : !done.ok ? "bg-muted-foreground" : sc! >= 70 ? "bg-primary" : sc! >= 40 ? "bg-accent" : "bg-destructive";
              return (
                <li key={tg.url} className="text-xs">
                  <button type="button" onClick={() => setOpen(open === tg.url ? null : tg.url)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-start hover:bg-muted/60">
                    <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />
                    <span className="truncate flex-1">{tg.url}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{tg.platform || tg.kind}</span>
                  </button>
                  {open === tg.url && done && (
                    <div className="ms-5 mt-1 space-y-1 border-s border-border ps-2" dir={lang === "en" ? "ltr" : "rtl"}>
                      {done.findings.map((f: any) => (
                        <div key={f.axis} className="flex items-center gap-2">
                          <span className="w-10 font-semibold">{f.axis.toUpperCase()}</span>
                          <span className={tone(f.score)}>{f.score ?? t.un}</span>
                          <span className="flex-1 truncate text-muted-foreground" dir="ltr">{f.evidence.join(" · ")}</span>
                          {f.score != null && f.score < 70 && <button type="button" onClick={() => onTask(TASK[lang](f.axis, tg.url))} className="inline-flex items-center gap-0.5 text-primary hover:underline">{t.task}<ArrowUpRight className="size-3" /></button>}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {status === "cancelled" && <p className="mt-2 text-xs text-muted-foreground">{t.cancelled}</p>}
          {status === "failed" && <p className="mt-2 text-xs text-destructive">{t.failed}</p>}
          {result && result.succeeded < result.total && result.succeeded > 0 && <p className="mt-2 text-xs text-muted-foreground">{t.partial} ({result.succeeded}/{result.total})</p>}
          {!result && !running && status !== "failed" && status !== "cancelled" && <p className="mt-2 text-xs text-muted-foreground">{t.none}</p>}

          <div className="mt-3">
            {running ? (
              <div className="flex items-center gap-2 text-xs"><Loader2 className="size-3.5 animate-spin" />{t.running}
                <button type="button" onClick={cancel} className="ms-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"><X className="size-3" />{t.stop}</button></div>
            ) : ask ? (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-background/60 p-2 text-xs">
                <div>{t.est}: <b>{est.estimate}</b> · {t.bal}: <b>{est.balance}</b></div>
                <div className="flex gap-2">
                  <button type="button" onClick={start} disabled={est.estimate > est.balance} className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{t.confirm}</button>
                  <button type="button" onClick={() => setAsk(false)} className="rounded-md border border-border px-3 py-1">{t.cancel}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAsk(true)} disabled={!est.priced} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{t.start}</button>
            )}
            {!est.priced && <p className="mt-1 text-[11px] text-muted-foreground">{t.unpriced}</p>}
          </div>
        </>
      )}
    </div>
  );
}
