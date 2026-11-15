// Starts and follows the real deep account audit (background job). Shows cost first, asks for approval.
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ExportButtons } from "@/components/ExportButtons";

type L = "ar" | "en" | "ku";
const AXIS_NAME: Record<string, Record<L, string>> = {
  seo: { ar: "SEO · جاهزية الصفحة التقنية", en: "SEO · On-page technical readiness", ku: "SEO · ئامادەیی تەکنیکی پەڕە" },
  aeo: { ar: "AEO · قابلية استخراج الإجابات", en: "AEO · Answer extraction readiness", ku: "AEO · ئامادەیی دەرهێنانی وەڵام" },
  geo: { ar: "GEO · إشارات المحتوى والكيان", en: "GEO · Content and entity signals", ku: "GEO · نیشانەکانی ناوەڕۆک و قەوارە" },
  sge: { ar: "SGE · قابلية تنظيم المحتوى للبحث التوليدي", en: "SGE · Generative-search content structure", ku: "SGE · پێکهاتەی ناوەڕۆک بۆ گەڕانی زایەندراو" },
  gseo: { ar: "GSEO · اتساق إشارات العلامة (تعريف معروف)", en: "GSEO · Brand-signal consistency (Maaroof-defined)", ku: "GSEO · یەکگرتوویی نیشانەکانی براند (پێناسەی مەعروف)" },
};
const SIGNAL: Record<string, Record<L, string>> = {
  title_present: { ar: "عنوان الصفحة موجود", en: "Page title is present", ku: "ناونیشانی پەڕە هەیە" },
  meta_description_present: { ar: "الوصف التعريفي موجود", en: "Meta description is present", ku: "وەسفی مێتا هەیە" },
  h1_present: { ar: "عنوان رئيسي H1 موجود", en: "Main H1 heading is present", ku: "سەردێڕی سەرەکی H1 هەیە" },
  section_headings_present: { ar: "عناوين الأقسام موجودة", en: "Section headings are present", ku: "سەردێڕەکانی بەشەکان هەن" },
  canonical_present: { ar: "رابط Canonical موجود", en: "Canonical URL is present", ku: "بەستەری Canonical هەیە" },
  robots_directive_present: { ar: "توجيهات Robots موجودة", en: "Robots directives are present", ku: "ڕێنماییەکانی Robots هەن" },
  substantive_body: { ar: "محتوى نصي كافٍ مرصود", en: "Substantive page text detected", ku: "دەقی ناوەڕۆکی بەڕێژە دۆزرایەوە" },
  product_schema_present: { ar: "بيانات منظمة للمنتج موجودة", en: "Product structured data is present", ku: "داتای ڕێکخراوی بەرهەم هەیە" },
  explicit_answer_blocks: { ar: "كتل إجابة مباشرة مرصودة", en: "Direct-answer blocks detected", ku: "بلۆکی وەڵامی ڕاستەوخۆ دۆزرایەوە" },
  question_answer_pairs: { ar: "أزواج سؤال وجواب مرصودة", en: "Question-and-answer pairs detected", ku: "جووتی پرسیار و وەڵام دۆزرایەوە" },
  faqpage_schema: { ar: "مخطط FAQPage موجود", en: "FAQPage schema is present", ku: "سکیمای FAQPage هەیە" },
  faq_section_heading: { ar: "عنوان قسم الأسئلة الشائعة موجود", en: "FAQ section heading is present", ku: "سەردێڕی بەشی پرسیارە باوەکان هەیە" },
  answer_context_depth: { ar: "سياق نصي داعم كافٍ", en: "Sufficient supporting answer context", ku: "کۆنتێکستی پشتگیریکەری وەڵام بەسە" },
  brand_in_opening: { ar: "اسم العلامة وارد في بداية المحتوى", en: "Brand name appears near the content opening", ku: "ناوی براند لە سەرەتای ناوەڕۆکدا هەیە" },
  organization_schema: { ar: "مخطط Organization موجود", en: "Organization schema is present", ku: "سکیمای Organization هەیە" },
  product_schema: { ar: "مخطط Product/Offer موجود", en: "Product/Offer schema is present", ku: "سکیمای Product/Offer هەیە" },
  sameas_entity_links: { ar: "روابط sameAs للهوية موجودة", en: "sameAs identity links are present", ku: "بەستەرەکانی ناسنامەی sameAs هەن" },
  source_urls_in_content: { ar: "روابط مصادر واردة في المحتوى", en: "Source URLs appear in the content", ku: "بەستەری سەرچاوە لە ناوەڕۆکدا هەن" },
  descriptive_metadata: { ar: "بيانات وصفية موجودة", en: "Descriptive metadata is present", ku: "داتای وەسفی هەیە" },
  concise_lead_15_80_words: { ar: "مقدمة موجزة بطول 15–80 كلمة", en: "Concise 15–80 word lead detected", ku: "پێشەکییەکی کورت لە 15–80 وشەدا دۆزرایەوە" },
  structured_list: { ar: "قائمة منظمة مرصودة", en: "Structured list detected", ku: "لیستی ڕێکخراو دۆزرایەوە" },
  comparison_table: { ar: "جدول مقارنة مرصود", en: "Comparison table detected", ku: "خشتەی بەراورد دۆزرایەوە" },
  supporting_context: { ar: "سياق داعم إضافي مرصود", en: "Additional supporting context detected", ku: "کۆنتێکستی پشتگیریکەری زیادە دۆزرایەوە" },
  brand_in_title: { ar: "اسم العلامة وارد في العنوان", en: "Brand name appears in the title", ku: "ناوی براند لە ناونیشاندا هەیە" },
  brand_in_description: { ar: "اسم العلامة وارد في الوصف", en: "Brand name appears in the description", ku: "ناوی براند لە وەسفدا هەیە" },
  brand_in_body: { ar: "اسم العلامة وارد في متن الصفحة", en: "Brand name appears in page content", ku: "ناوی براند لە دەقی پەڕەدا هەیە" },
};
const T = {
  ar: { start: "ابدأ الفحص العميق", confirm: "موافق، ابدأ", cancel: "إلغاء", est: "الكلفة التقديرية", bal: "رصيدك", per: "لكل رابط", note: "يُخصم فقط عن الروابط التي قُرئت فعلاً. الفشل لا يُحسب.", running: "جارٍ الفحص في الخلفية — يمكنك متابعة التصفح", done: "نتيجة الفحص", overall: "مؤشر جاهزية الصفحة المرجّح", un: "لم يُقَس بعد", failed: "تعذّر الفحص", charged: "خُصم", read: "قُرئ", of: "من", nolinks: "أضف روابط لتفعيل الفحص.", unpriced: "لم يُسعَّر الفحص لحسابك بعد." },
  en: { start: "Start deep audit", confirm: "Approve & start", cancel: "Cancel", est: "Estimated cost", bal: "Your balance", per: "per link", note: "Charged only for links actually read. Failures are free.", running: "Auditing in the background — keep browsing", done: "Audit result", overall: "Weighted page-readiness indicator", un: "Not measured yet", failed: "Audit failed", charged: "Charged", read: "Read", of: "of", nolinks: "Add links to enable the audit.", unpriced: "The audit is not priced for your account yet." },
  ku: { start: "دەستپێکردنی پشکنینی قووڵ", confirm: "ڕازیم، دەست پێبکە", cancel: "هەڵوەشاندنەوە", est: "تێچووی خەمڵێنراو", bal: "باڵانس", per: "بۆ هەر بەستەرێک", note: "تەنها بۆ بەستەرە خوێنراوەکان دەبڕدرێت.", running: "پشکنین لە پاشبنەمادا — بەردەوام بە", done: "ئەنجامی پشکنین", overall: "پێوەری کێشدار بۆ ئامادەیی پەڕە", un: "هێشتا نەپێوراوە", failed: "پشکنین سەرنەکەوت", charged: "بڕدرا", read: "خوێنرایەوە", of: "لە", nolinks: "بەستەر زیاد بکە.", unpriced: "نرخ دانەنراوە." },
};
const EXPLAIN: Record<L, { basis: string; notProof: string; numericCaveat: string }> = {
  ar: { basis: "هذه درجات استدلالية لتهيئة الصفحة ومحتواها وفق إشارات تقنية مرصودة، وليست قياساً لترتيب Google أو ظهور العلامة في إجابات نماذج الذكاء الاصطناعي.", notProof: "لا يثبت هذا الفحص الفهرسة أو الترتيب أو الاقتباس أو الظهور الفعلي في محركات الذكاء الاصطناعي. يلزم فحص مستقل لكل محرك لإثبات ذلك.", numericCaveat: "أرقام مرصودة في النص؛ لم يتم التحقق من صحتها أو مصادرها." },
  en: { basis: "These are heuristic page-readiness scores based on detected technical and content signals, not Google rankings or measured brand visibility in AI answers.", notProof: "This audit does not prove indexing, ranking, citations, or actual AI-engine visibility. Separate engine-level probes are required.", numericCaveat: "Numeric strings detected in text; their accuracy and sources were not verified." },
  ku: { basis: "ئەم نمرانە خەمڵاندنی ئامادەیی پەڕەن لەسەر بنەمای نیشانە تەکنیکی و ناوەڕۆکییە دۆزراوەکان، نەک ڕیزبەندی گووگڵ یان دەرکەوتنی پێوراو لە وەڵامی زیرەکی دەستکرد.", notProof: "ئەم پشکنینە فهرستکردن، ڕیزبەندی، ئاماژەپێدان یان دەرکەوتنی ڕاستەقینە لە بزوێنەرەکانی زیرەکی دەستکرد ناسەلمێنێت.", numericCaveat: "ژمارە لە دەقدا دۆزراونەتەوە؛ دروستی و سەرچاوەکانیان پشتڕاست نەکراونەتەوە." },
};
function explainSignal(raw: string, lang: L): string {
  const exact = SIGNAL[raw]?.[lang];
  if (exact) return exact;
  const count = raw.match(/^(verifiable_numeric_claims_first_150):(\\d+)$/);
  if (count) return `${EXPLAIN[lang].numericCaveat} (${count[2]})`;
  const sections = raw.match(/^structured_sections:(\\d+)$/);
  if (sections) return lang === "ar" ? `عدد عناوين الأقسام المرصودة: ${sections[1]}` : lang === "ku" ? `ژمارەی سەردێڕە دۆزراوەکان: ${sections[1]}` : `Section headings detected: ${sections[1]}`;
  return raw.replace(/_/g, " ");
}
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
  const axisRows = result ? Object.entries(result.axes || {}).map(([k, v]) => [AXIS_NAME[k]?.[lang] || k.toUpperCase(), v == null ? t.un : `${v}/100`] as [string, string]) : [];

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
          <div className="font-semibold">{t.done} — {t.overall}: {result.overall ?? t.un}/100</div>\n          <p className="text-xs leading-5 text-muted-foreground">{EXPLAIN[lang].basis}</p>\n          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs leading-5">{EXPLAIN[lang].notProof}</p>
          <div className="text-muted-foreground">{t.read} {result.succeeded} {t.of} {result.total} · {t.charged} {result.charged}</div>
          <div className="grid grid-cols-5 gap-1 text-center">{axisRows.map(([k, v]) => <div key={k} className="rounded bg-muted p-1"><div className="font-semibold">{k}</div><div>{v}</div></div>)}</div>
          {result.targets.map((tg: any) => (
            <div key={tg.url} className="border-t border-border pt-1">
              <div dir="ltr" className="truncate font-medium">{tg.url}</div>
              {tg.findings.map((f: any) => <div key={f.axis} className="text-muted-foreground">{f.axis.toUpperCase()}: {VERDICT[f.verdict][lang]}{f.score != null ? ` (${f.score})` : ""}{f.evidence.length ? ` — ${f.evidence.map((signal: string) => explainSignal(signal, lang)).join(" · ")}` : ""}</div>)}
            </div>
          ))}
          <ExportButtons build={() => ({
            title: t.done, lang, sections: [
              { heading: t.overall, kind: "kv", rows: [[t.overall, result.overall ?? t.un], ...axisRows] },
              ...result.targets.map((tg: any) => ({ heading: tg.url, kind: "table" as const, table: { columns: [lang === "ar" ? "المحور" : lang === "ku" ? "تەوەر" : "Axis", lang === "ar" ? "الدرجة" : lang === "ku" ? "نمرە" : "Score", lang === "ar" ? "التقييم" : lang === "ku" ? "هەڵسەنگاندن" : "Verdict", lang === "ar" ? "الإشارات المرصودة (ليست إثبات ظهور)" : lang === "ku" ? "نیشانە دۆزراوەکان" : "Detected signals (not visibility proof)"], data: tg.findings.map((f: any) => [AXIS_NAME[f.axis]?.[lang] || f.axis.toUpperCase(), f.score ?? "—", VERDICT[f.verdict][lang], f.evidence.map((signal: string) => explainSignal(signal, lang)).join(", ")]) } })),
            ],
          }) as any} />
        </div>
      )}
    </div>
  );
}
