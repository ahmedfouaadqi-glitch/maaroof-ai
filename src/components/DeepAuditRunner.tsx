// Starts and follows the real deep account audit (background job). Shows cost first, asks for approval.
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ExportButtons } from "@/components/ExportButtons";

type L = "ar" | "en" | "ku";
const T = {
  ar: { start: "ابدأ الفحص العميق", confirm: "موافق، ابدأ", cancel: "إلغاء", est: "الكلفة التقديرية", bal: "رصيدك", per: "لكل رابط", note: "يُخصم فقط عن الروابط التي قُرئت فعلاً. الفشل لا يُحسب.", running: "جارٍ الفحص في الخلفية — يمكنك متابعة التصفح", done: "نتيجة الفحص", overall: "الدرجة المرجّحة", un: "لم يُقَس بعد", failed: "تعذّر الفحص", charged: "خُصم", read: "قُرئ", of: "من", nolinks: "أضف روابط لتفعيل الفحص.", unpriced: "لم يُسعَّر الفحص لحسابك بعد." },
  en: { start: "Start deep audit", confirm: "Approve & start", cancel: "Cancel", est: "Estimated cost", bal: "Your balance", per: "per link", note: "Charged only for links actually read. Failures are free.", running: "Auditing in the background — keep browsing", done: "Audit result", overall: "Weighted score", un: "Not measured yet", failed: "Audit failed", charged: "Charged", read: "Read", of: "of", nolinks: "Add links to enable the audit.", unpriced: "The audit is not priced for your account yet." },
  ku: { start: "دەستپێکردنی پشکنینی قووڵ", confirm: "ڕازیم، دەست پێبکە", cancel: "هەڵوەشاندنەوە", est: "تێچووی خەمڵێنراو", bal: "باڵانس", per: "بۆ هەر بەستەرێک", note: "تەنها بۆ بەستەرە خوێنراوەکان دەبڕدرێت.", running: "پشکنین لە پاشبنەمادا — بەردەوام بە", done: "ئەنجامی پشکنین", overall: "نمرەی کێشدار", un: "هێشتا نەپێوراوە", failed: "پشکنین سەرنەکەوت", charged: "بڕدرا", read: "خوێنرایەوە", of: "لە", nolinks: "بەستەر زیاد بکە.", unpriced: "نرخ دانەنراوە." },
};
const VERDICT: Record<string, Record<L, string>> = {
  good: { ar: "جيد", en: "Good", ku: "باش" }, weak: { ar: "ضعيف", en: "Weak", ku: "لاواز" },
  missing: { ar: "غائب", en: "Missing", ku: "نییە" }, unmeasured: { ar: "لم يُقَس", en: "Unmeasured", ku: "نەپێوراو" },
};

async function authed(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const tok = data.session?.access_token;
  return fetch(path, { ...init, headers: { ...(init.headers || {}), "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) } });
}

export function DeepAuditRunner({ lang, hasLinks }: { lang: L; hasLinks: boolean }) {
  const t = T[lang];
  const [est, setEst] = useState<any>(null);
  const [ask, setAsk] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  const after = useRef(0);

  async function loadEstimate() {
    const r = await authed("/api/deep-audit"); if (!r.ok) return;
    const j = await r.json(); setEst(j);
    if (j.last?.id && !jobId) { after.current = 0; setJobId(j.last.id); }
  }
  useEffect(() => { loadEstimate().catch(() => {}); }, []);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      const r = await authed(`/api/maaroof-jobs?id=${jobId}&after=${after.current}`).catch(() => null);
      if (!r || !r.ok) return;
      const j = await r.json();
      setStatus(j.job.status); if (j.job.error) setErr(j.job.error);
      for (const e of j.events || []) {
        after.current = Math.max(after.current, e.seq);
        if (e.event_type === "audit_target") setProgress({ i: e.payload.index, n: e.payload.total });
        if (e.event_type === "audit_result") setResult(e.payload);
      }
      if (!stop && (j.job.status === "running" || j.job.status === "queued")) setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [jobId]);

  async function start() {
    setAsk(false); setErr(""); setResult(null); setProgress(null);
    const r = await authed("/api/deep-audit", { method: "POST", body: JSON.stringify({ approved: true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(t.failed); return; }
    after.current = 0; setStatus("running"); setJobId(j.job_id);
  }

  const running = status === "running" || status === "queued";
  const axisRows = result ? Object.entries(result.axes || {}).map(([k, v]) => [k.toUpperCase(), v == null ? t.un : `${v}/100`] as [string, string]) : [];

  if (!hasLinks) return <p className="mt-2 text-muted-foreground">{t.nolinks}</p>;
  return (
    <div className="mt-3 space-y-2">
      {!running && !ask && (
        <button type="button" onClick={() => setAsk(true)} disabled={!est || !est.priced} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{t.start}</button>
      )}
      {est && !est.priced && <p className="text-muted-foreground">{t.unpriced}</p>}
      {ask && est && (
        <div className="space-y-1 rounded-lg border border-primary/30 bg-background/60 p-2">
          <div>{t.est}: <b>{est.estimate}</b> ({est.perTarget} {t.per}) · {t.bal}: <b>{est.balance}</b></div>
          <ul className="list-disc ps-4" dir="ltr">{est.targets.map((x: any) => <li key={x.url}>{x.url} — {x.axes.map((a: string) => a.toUpperCase()).join(" ")}</li>)}</ul>
          <p className="text-muted-foreground">{t.note}</p>
          <div className="flex gap-2">
            <button type="button" onClick={start} className="rounded-md bg-primary px-3 py-1 text-primary-foreground">{t.confirm}</button>
            <button type="button" onClick={() => setAsk(false)} className="rounded-md border border-border px-3 py-1">{t.cancel}</button>
          </div>
        </div>
      )}
      {running && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />{t.running}</div>
          <div className="h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress ? (progress.i / progress.n) * 100 : 5}%` }} /></div>
        </div>
      )}
      {status === "failed" && err && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-destructive">{err}</p>
          <button type="button" onClick={start} className="rounded-md border border-border px-3 py-1">{lang === "en" ? "Retry" : lang === "ku" ? "دووبارە هەوڵبدەوە" : "إعادة المحاولة"}</button>
        </div>
      )}
      {result && (
        <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2">
          <div className="font-semibold">{t.done} — {t.overall}: {result.overall ?? t.un}</div>
          <div className="text-muted-foreground">{t.read} {result.succeeded} {t.of} {result.total} · {t.charged} {result.charged}</div>
          <div className="grid grid-cols-5 gap-1 text-center">{axisRows.map(([k, v]) => <div key={k} className="rounded bg-muted p-1"><div className="font-semibold">{k}</div><div>{v}</div></div>)}</div>
          {result.targets.map((tg: any) => (
            <div key={tg.url} className="border-t border-border pt-1">
              <div dir="ltr" className="truncate font-medium">{tg.url}</div>
              {tg.findings.map((f: any) => <div key={f.axis} className="text-muted-foreground">{f.axis.toUpperCase()}: {VERDICT[f.verdict][lang]}{f.score != null ? ` (${f.score})` : ""}{f.evidence.length ? ` — ${f.evidence.join("، ")}` : ""}</div>)}
            </div>
          ))}
          <ExportButtons build={() => ({
            title: t.done, lang, sections: [
              { heading: t.overall, kind: "kv", rows: [[t.overall, result.overall ?? t.un], ...axisRows] },
              ...result.targets.map((tg: any) => ({ heading: tg.url, kind: "table" as const, table: { columns: ["Axis", "Score", "Verdict", "Evidence"], data: tg.findings.map((f: any) => [f.axis.toUpperCase(), f.score ?? "—", VERDICT[f.verdict][lang], f.evidence.join(", ")]) } })),
            ],
          }) as any} />
        </div>
      )}
    </div>
  );
}
