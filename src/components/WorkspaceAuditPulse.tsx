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
const NOTE: Record<L, string> = { ar: "النتيجة تعكس الأدلة العامة التي أمكن الوصول إليها وقت الفحص", en: "Results reflect the public evidence accessible at scan time", ku: "ئەنجامەکان بەڵگە گشتییە دەستپێگەیشتووەکان لە کاتی پشکنین پیشان دەدەن" };

const SGEO_COPY: Record<L, {
  title: string; description: string; notAvailable: string; measuredTargets: string;
  overlapPillars: string; coverage: string; matched: string;
  entityClarity: string; answerStructure: string; factualContent: string; machineExtractability: string;
}> = {
  ar: {
    title: "مؤشر SGEO المركّب",
    description: "يقيس نقاط التقاطع المدعومة بالأدلة بين SEO وAEO وGEO وSGE. ليس محورًا سادسًا، ولا يغيّر الدرجة الإجمالية؛ ويبقى GSEO محورًا مستقلًا.",
    notAvailable: "لا تتضمن هذه النتيجة القديمة بيانات كافية لحساب المؤشر المركّب. أجرِ فحصًا جديدًا لحسابه.",
    measuredTargets: "المصادر التي اكتملت فيها قياسات المحاور الأربعة",
    overlapPillars: "أنماط التقاطع المشتركة",
    coverage: "تغطية التقاطع",
    matched: "مصادر متطابقة",
    entityClarity: "وضوح الكيان",
    answerStructure: "بنية الإجابة",
    factualContent: "المحتوى الحقائقي",
    machineExtractability: "قابلية الاستخراج آليًا",
  },
  en: {
    title: "SGEO composite index",
    description: "Measures evidence-backed overlap across SEO, AEO, GEO and SGE. It is not a sixth axis and does not change the overall score; GSEO remains a separate axis.",
    notAvailable: "This historical result does not contain enough data to calculate the composite index. Run a new scan to calculate it.",
    measuredTargets: "Targets with all four core axes measured",
    overlapPillars: "Shared overlap patterns",
    coverage: "Overlap coverage",
    matched: "matching targets",
    entityClarity: "Entity clarity",
    answerStructure: "Answer structure",
    factualContent: "Factual content",
    machineExtractability: "Machine extractability",
  },
  ku: {
    title: "پێوەری پێکهاتەیی SGEO",
    description: "هاوبەشی بەڵگەدار لە نێوان SEO وAEO وGEO وSGE دەپێوێت. تەوەرێکی شەشەم نییە و نمرەی گشتی ناگۆڕێت؛ GSEO تەوەرێکی جیاواز دەمێنێتەوە.",
    notAvailable: "ئەنجامی پێشووتر داتای پێویستی بۆ هەژمارکردنی پێوەری پێکهاتەیی نییە. پشکنینێکی نوێ بکە.",
    measuredTargets: "سەرچاوەکانی کە هەموو چوار تەوەرە سەرەکییەکەیان پێوراوە",
    overlapPillars: "جۆرە هاوبەشەکانی تێکەڵبوون",
    coverage: "ڕێژەی هاوبەشی",
    matched: "سەرچاوەی هاوشێوە",
    entityClarity: "ڕوونی قەوارە",
    answerStructure: "پێکهاتەی وەڵام",
    factualContent: "ناوەڕۆکی ڕاستی",
    machineExtractability: "دەرکێشانی ئامێری",
  },
};

function sgeoPillarLabel(lang: L, key: string): string {
  const c = SGEO_COPY[lang];
  const labels: Record<string, string> = {
    entity_clarity: c.entityClarity,
    answer_structure: c.answerStructure,
    factual_content: c.factualContent,
    machine_extractability: c.machineExtractability,
  };
  return labels[key] || key;
}


const ISSUE_TEXT: Record<L, Record<string, string>> = {
  ar: {
    instagram_automated_access_denied: "Instagram رفض القراءة الآلية لهذه الصفحة؛ لا يعني ذلك أن الرابط غير صالح، ويمكن إعادة المحاولة لاحقًا.",
    instagram_rate_limited: "Instagram قيّد طلبات القراءة الآلية لهذه الصفحة مؤقتًا؛ يُفضّل إعادة المحاولة لاحقًا.",
    target_access_restricted: "الموقع لم يسمح بقراءة الصفحة آليًا؛ قد تنجح المحاولة لاحقًا.",
    target_rate_limited: "الموقع قيّد طلبات القراءة مؤقتًا؛ أعد المحاولة لاحقًا.",
    reader_rate_limited: "وصلت خدمة القراءة إلى حدّ مؤقت للطلبات؛ أعد المحاولة بعد قليل.",
    reader_quota_reached: "وصلت سعة القراءة المتاحة لهذه العملية إلى حدها الحالي؛ أعد المحاولة لاحقًا.",
    access_restricted: "تعذّرت القراءة الآلية لهذه الصفحة؛ قد تنجح المحاولة لاحقًا.",
    rate_limited: "وُضع حد مؤقت لطلبات القراءة؛ أعد المحاولة لاحقًا.",
    timeout: "استغرقت قراءة الصفحة وقتًا أطول من المسموح؛ لم تُحتسب درجة.",
    source_unavailable: "تعذّر الحصول على محتوى صالح من هذا المصدر.",
    insufficient_public_content: "لم يتوفر محتوى عام كافٍ لقياس هذا المصدر.",
    no_public_content: "لم يُستخرج محتوى عام كافٍ من الرابط.",
    insufficient_content_for_axis: "المعلومات التعريفية وحدها لا تكفي لقياس هذا المحور؛ يلزم محتوى أعمق.",
    needs_full_page_content: "يتطلب هذا المحور محتوى الصفحة، لا العنوان والوصف فقط.",
  },
  en: {
    instagram_automated_access_denied: "Instagram declined automated reading of this page. This does not mean the link is invalid; you can retry later.",
    instagram_rate_limited: "Instagram temporarily limited automated reading requests for this page. Please retry later.",
    target_access_restricted: "The website did not allow automated reading of this page. A later retry may work.",
    target_rate_limited: "The website temporarily limited read requests. Please retry later.",
    reader_rate_limited: "The content-reading route reached a temporary request limit. Please retry shortly.",
    reader_quota_reached: "The available reading capacity for this operation has been reached. Please retry later.",
    access_restricted: "Automated reading of this page was not permitted. A later retry may work.",
    rate_limited: "A temporary reading-request limit was reached. Please retry later.",
    timeout: "Reading this page took too long; no score was assigned.",
    source_unavailable: "No usable public content could be retrieved from this source.",
    insufficient_public_content: "There was not enough public content to measure this source.",
    no_public_content: "Not enough public content was extracted from this URL.",
    insufficient_content_for_axis: "Profile metadata alone cannot measure this axis; deeper content is required.",
    needs_full_page_content: "This axis requires page content, not only a title and description.",
  },
  ku: {
    instagram_automated_access_denied: "Instagram ڕێگەی خوێندنەوەی ئۆتۆماتیکی ئەم پەڕەیەی نەدا؛ ئەمە واتای خراپی بەستەرەکە نییە، دەتوانیت دواتر دووبارە هەوڵ بدەیت.",
    instagram_rate_limited: "Instagram داواکارییەکانی خوێندنەوەی ئۆتۆماتیکی بۆ ئەم پەڕەیە کاتی سنووردار کرد؛ دواتر دووبارە هەوڵ بدە.",
    target_access_restricted: "ماڵپەڕەکە ڕێگەی خوێندنەوەی ئۆتۆماتیکی نەدا؛ لە دواتردا دووبارە هەوڵ بدە.",
    target_rate_limited: "ماڵپەڕەکە داواکارییەکانی خوێندنەوەی کاتی سنووردار کرد؛ دواتر هەوڵ بدە.",
    reader_rate_limited: "ڕێڕەوی خوێندنەوە گەیشتە سنووری کاتی داواکاری؛ کەمێک دواتر هەوڵ بدە.",
    reader_quota_reached: "توانای خوێندنەوەی بەردەست بۆ ئەم کردارە گەیشتە سنوورەکەی؛ دواتر هەوڵ بدە.",
    access_restricted: "خوێندنەوەی ئۆتۆماتیکی ئەم پەڕەیە ڕێگەپێنەدرا؛ دواتر هەوڵ بدە.",
    rate_limited: "داواکارییەکانی خوێندنەوە کاتی سنووردار کران؛ دواتر هەوڵ بدە.",
    timeout: "خوێندنەوەی ئەم پەڕەیە زۆر درێژ خایاند؛ نمرەیەک نەدرا.",
    source_unavailable: "ناوەڕۆکی گشتیی بەکارهێنراو لەم سەرچاوەیەوە بەدەست نەهات.",
    insufficient_public_content: "ناوەڕۆکی گشتی بەس نییە بۆ پێوانەکردنی ئەم سەرچاوەیە.",
    no_public_content: "ناوەڕۆکی گشتیی پێویست لەم بەستەرەوە نەدەرکرا.",
    insufficient_content_for_axis: "زانیاریی ناسنامە بە تەنها بۆ پێوانەکردنی ئەم تەوەرە بەس نییە.",
    needs_full_page_content: "ئەم تەوەرە ناوەڕۆکی تەواوی پەڕەی دەوێت، نەک تەنها ناونیشان و وەسف.",
  },
};
const issueText = (lang: L, key?: string | null) => key ? ISSUE_TEXT[lang][key] || ISSUE_TEXT[lang].source_unavailable : "";

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
          {result && (
            <section className="mt-3 rounded-xl border border-border bg-background/50 p-3" aria-label={SGEO_COPY[lang].title}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{SGEO_COPY[lang].title}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{SGEO_COPY[lang].description}</p>
                </div>
                <div className="min-w-16 text-center">
                  <div className={`text-2xl font-bold ${tone(typeof result.sgeo?.score === "number" ? result.sgeo.score : null)}`}>
                    {typeof result.sgeo?.score === "number" ? result.sgeo.score : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">/100</div>
                </div>
              </div>
              {result.sgeo ? (
                <>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {SGEO_COPY[lang].measuredTargets}: {result.sgeo.measuredTargets}/{result.sgeo.totalTargets}
                  </p>
                  <div className="mt-2">
                    <div className="mb-1 text-[11px] font-semibold">{SGEO_COPY[lang].overlapPillars}</div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {(result.sgeo.pillars || []).map((pillar: any) => (
                        <div key={pillar.key} className="rounded-lg bg-muted/60 p-2">
                          <div className="text-[11px] font-medium">{sgeoPillarLabel(lang, String(pillar.key))}</div>
                          <div className="mt-1 text-sm font-semibold">{typeof pillar.coveragePercent === "number" ? `${pillar.coveragePercent}%` : "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{Number(pillar.matchedTargets) || 0} {SGEO_COPY[lang].matched}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">{SGEO_COPY[lang].notAvailable}</p>
              )}
            </section>
          )}

          {result && <div className="mt-2 flex justify-end"><ExportButtons size="xs" toolKey="maaroof" build={() => {
            const axisLabels: Record<string, string> = { seo: "SEO", aeo: "AEO", geo: "GEO", sge: "SGE", gseo: "GSEO" };
            const axisCards = AX.map((axis) => {
              const score = result.axes?.[axis] ?? null;
              const measuredLinks = (result.targets || []).filter((target: any) => (target.findings || []).some((finding: any) => finding.axis === axis && finding.score != null)).length;
              return { title: axis.toUpperCase(), score, status: typeof score === "number" ? "measured" : "unmeasured", fields: [[lang === "en" ? "Sources measured" : lang === "ku" ? "سەرچاوە پێوراوەکان" : "المصادر المقاسة", String(measuredLinks) + "/" + String((result.targets || []).length)] as [string, string | number]] };
            });
            const sgeo = result.sgeo || null;
            const sgeoHeading = lang === "en" ? "SGEO composite index (derived, not an extra axis)" : lang === "ku" ? "پێوەری پێکهاتەیی SGEO (تەوەری زیادە نییە)" : "مؤشر SGEO المركّب (مشتق وليس محورًا إضافيًا)";
            const sgeoRows: Array<[string, string | number]> = [
              [lang === "en" ? "Overlap score" : lang === "ku" ? "نمرەی هاوبەشی" : "درجة التقاطع", typeof sgeo?.score === "number" ? sgeo.score : (lang === "en" ? "Not measured" : lang === "ku" ? "نەپێوراو" : "لم يُقَس")],
              [lang === "en" ? "Targets with all four core axes measured" : lang === "ku" ? "سەرچاوەکانی چوار تەوەرەکەیان پێوراوە" : "مصادر قِيست فيها المحاور الأربعة", sgeo ? `${sgeo.measuredTargets}/${sgeo.totalTargets}` : (lang === "en" ? "Not available in this historical scan" : lang === "ku" ? "لە ئەم پشکنینە پێشووترەدا نییە" : "غير متوفر في هذا الفحص السابق")],
              ...((sgeo?.pillars || []).map((pillar: any) => [sgeoPillarLabel(lang, String(pillar.key)), typeof pillar.coveragePercent === "number" ? `${pillar.coveragePercent}%` : (lang === "en" ? "Not measured" : lang === "ku" ? "نەپێوراو" : "لم يُقَس")] as [string, string | number])),
            ];
            const targetCards = (result.targets || []).map((target: any) => {
              const measured = (target.findings || []).filter((finding: any) => finding.score != null);
              const average = measured.length ? Math.round(measured.reduce((sum: number, finding: any) => sum + finding.score, 0) / measured.length) : null;
              return {
                title: target.url,
                subtitle: target.platform || target.kind,
                score: average,
                status: target.read_status || (target.ok ? "measured" : "unmeasured"),
                fields: (target.findings || []).map((finding: any) => [axisLabels[finding.axis] || finding.axis.toUpperCase(), finding.score == null ? "unmeasured" : String(finding.score) + "/100"] as [string, string | number]),
                evidence: (target.findings || []).filter((finding: any) => finding.evidence?.length).map((finding: any) => (axisLabels[finding.axis] || finding.axis.toUpperCase()) + ": " + finding.evidence.join(" · ")),
                notes: [target.read_issue, ...(target.findings || []).filter((finding: any) => finding.score == null).map((finding: any) => finding.reason)].filter(Boolean),
              };
            });
            const headline = lang === "en" ? "Audit summary" : lang === "ku" ? "پوختەی پشکنین" : "ملخص الفحص";
            const targetsHeading = lang === "en" ? "Per-link audit cards" : lang === "ku" ? "کارتی پشکنینی هەر بەستەر" : "بطاقات فحص كل رابط";
            return {
              title: t.title,
              subtitle: est.workspace_name || est.brand || (lang === "en" ? "Client digital presence" : lang === "ku" ? "بوونی دیجیتاڵی کڕیار" : "الحضور الرقمي للعميل"),
              lang,
              entity: { brand: est.brand || (targets[0]?.url ? new URL(targets[0].url).hostname : "Maaroof audit"), site: targets.find((x: any) => x.kind === "official")?.url || targets[0]?.url, links: targets.map((x: any) => x.url) },
              sections: [
                { heading: headline, kind: "kv", rows: [
                  [lang === "en" ? "Overall score" : lang === "ku" ? "نمرەی گشتی" : "النتيجة الإجمالية", result.overall ?? "unmeasured"],
                  [lang === "en" ? "Sources with measurable findings" : lang === "ku" ? "سەرچاوەکانی پێوانەکراو" : "المصادر ذات النتائج القابلة للقياس", String(result.succeeded) + "/" + String(result.total)],
                ] },
                { heading: lang === "en" ? "Axis score cards" : lang === "ku" ? "کارتی نمرەی تەوەرەکان" : "بطاقات درجات المحاور", kind: "cards", cards: axisCards },
                { heading: sgeoHeading, kind: "kv", rows: sgeoRows },
                { heading: targetsHeading, kind: "cards", cards: targetCards },
              ],
            };
          }} /></div>}

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
                      {done.read_issue && <p className="mb-2 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-5 text-muted-foreground">{issueText(lang, done.read_issue)}</p>}
                      {done.findings.map((f: any) => (
                        <div key={f.axis} className="flex items-center gap-2">
                          <span className="w-10 font-semibold">{f.axis.toUpperCase()}</span>
                          <span className={tone(f.score)}>{f.score ?? t.un}</span>
                          <span className="flex-1 min-w-0 text-muted-foreground" dir="auto">{f.score == null ? issueText(lang, f.reason) : f.evidence.join(" · ")}</span>
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
