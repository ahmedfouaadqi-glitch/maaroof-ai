// Micro-probe: let the user pick which of the ten engines to question live,
// see the expected cost against their balance, then show real answers.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Radar, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { ENGINES } from "@/components/engine-logos";
import { EngineResponseFlow, type EngineAnswer } from "@/components/EngineResponseFlow";
import { getEngineEntitlement } from "@/lib/ai-engines.functions";
import { getCostPreview, type CostPreview } from "@/lib/tokens.functions";
import { apiFetch } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";
import type { EngineKey } from "@/lib/ai-engines";

const TX = {
  ar: { title: "تحقق فعلياً من النماذج", hint: "اختر النماذج التي تريد سؤالها الآن — كلها أو بعضها.", all: "الكل", none: "لا شيء", cost: "الكلفة المتوقعة", bal: "رصيدك", low: "رصيدك لا يكفي لهذا العدد من النماذج", run: "اسأل النماذج المختارة", mode: "طريقة التشغيل", instant: "فوري", notify: "إشعاري (يصلك إشعار عند الانتهاء)", bg: "في الخلفية (يمكنك إغلاق الصفحة)", bgOk: "بدأ الفحص في الخلفية — ستصلك النتيجة في الإشعارات وسجل الأداة.", brandPh: "اكتب اسم علامتك التجارية", save: "احفظه في حسابي", locked: "غير متاح في باقتك", max: "الحد الأقصى", res: "إجابات فعلية من النماذج", rank: "ترتيبك", miss: "لم يذكر علامتك", free: "غير محسوب على رصيد", signIn: "يرجى تسجيل الدخول لاستخدام الفحص المباشر.", login: "تسجيل الدخول" },
  en: { title: "Check live with the engines", hint: "Pick the engines to ask now — all or some.", all: "All", none: "None", cost: "Expected cost", bal: "Your balance", low: "Your balance is not enough for this many engines", run: "Ask the selected engines", mode: "Run mode", instant: "Instant", notify: "Notify (you get a notification when done)", bg: "Background (you can close the page)", bgOk: "Running in the background — results arrive in notifications and tool history.", brandPh: "Type your brand name", save: "Save to my account", locked: "Not in your plan", max: "Max", res: "Live answers from the engines", rank: "Your rank", miss: "Did not mention your brand", free: "Not metered", signIn: "Please sign in to use the live check.", login: "Sign in" },
  ku: { title: "پشکنینی ڕاستەوخۆ لەگەڵ بزوێنەرەکان", hint: "ئەو بزوێنەرانە هەڵبژێرە کە دەتەوێت بپرسیت.", all: "هەموو", none: "هیچ", cost: "تێچووی چاوەڕوانکراو", bal: "باڵانسەکەت", low: "باڵانس بەس نییە", run: "پرسیار لە هەڵبژێردراوەکان", mode: "شێوازی کارکردن", instant: "دەستبەجێ", notify: "ئاگادارکردنەوە", bg: "لە پاشبنەمادا", bgOk: "لە پاشبنەمادا دەستی پێکرد — ئەنجام لە ئاگادارکردنەوەکاندا دێت.", brandPh: "ناوی براندەکەت بنووسە", save: "لە هەژمارەکەمدا پاشەکەوتی بکە", locked: "لە پلانەکەتدا نییە", max: "زۆرترین", res: "وەڵامی ڕاستەقینە", rank: "پلەت", miss: "ناوی تۆی نەهێنا", free: "نەژمێردراو", signIn: "تکایە بچۆ ژوورەوە بۆ بەکارهێنانی پشکنینی ڕاستەوخۆ.", login: "چوونەژوورەوە" },
};

type ProbeAnswer = { engine: string; mentioned: boolean; rank: number | null; answer: string; grounded_answer?: string; status?: string; brands: string[]; reason?: string };
type Council = { agreement: string; disagreement: string | null; decision: string };
type ProbeMetricValue = { value_pct: number | null; numerator: number; denominator: number };
type ProbeMetrics = {
  engine_coverage: ProbeMetricValue;
  mention_rate: ProbeMetricValue;
  recommendation_rate: ProbeMetricValue;
  share_of_voice: ProbeMetricValue;
  citation_rate: ProbeMetricValue;
  top5_rate: ProbeMetricValue;
  average_rank: number | null;
  answered_engines: number;
  requested_engines: number;
  limitations?: string[];
};

export function EngineProbePanel({ brand: brandProp, keywords, scope, allowBrandInput, workspaceId = null }: { brand: string; keywords?: string; scope?: unknown; allowBrandInput?: boolean; workspaceId?: string | null }) {
  const [typed, setTyped] = useState("");
  const [topic, setTopic] = useState(keywords || "");
  const [saveIt, setSaveIt] = useState(true);
  const brand = brandProp.trim() || typed;
  const probeTopic = topic.trim();
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const T = TX[L];
  const topicRequired = L === "en" ? "Enter a service/category so the blind question is not biased by your brand name." : L === "ku" ? "خزمەتگوزاری یان پۆل بنووسە بۆ ئەوەی پرسیاری کوێرانە بە ناوی براندەکەت ئاراستە نەکرێت." : "أدخل الخدمة أو الفئة حتى لا يتأثر السؤال الأعمى باسم علامتك.";
  const entFn = useServerFn(getEngineEntitlement);
  const costFn = useServerFn(getCostPreview);
  const [allowed, setAllowed] = useState<EngineKey[] | null>(null);
  const [sel, setSel] = useState<EngineKey[]>([]);
  const [cost, setCost] = useState<CostPreview | null>(null);
  const [mode, setMode] = useState<"instant" | "notify" | "background">(() => {
    try { const m = localStorage.getItem("run_mode:visibility.probe"); return m === "notify" || m === "background" ? m : "instant"; } catch { return "instant"; }
  });
  const [bgMsg, setBgMsg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<ProbeAnswer[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [council, setCouncil] = useState<Council | null>(null);
  const [metrics, setMetrics] = useState<ProbeMetrics | null>(null);

  useEffect(() => {
    entFn().then((e) => { setAllowed(e.allowed); setSel(e.allowed.slice(0, 10)); }).catch(() => setAllowed([]));
  }, []);
  useEffect(() => { if (keywords && !topic) setTopic(keywords); }, [keywords, topic]);

  const maxN = cost?.maxEngines ?? 10;
  useEffect(() => {
    if (!sel.length) { setCost(null); return; }
    costFn({ data: { toolKey: "visibility.probe", units: sel.length * 2 } }).then(setCost).catch(() => setCost(null));
  }, [sel.length]);

  useEffect(() => { try { localStorage.setItem("run_mode:visibility.probe", mode); } catch {} }, [mode]);

  function toggle(k: EngineKey) {
    setSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= maxN ? p : [...p, k]));
  }

  async function run() {
    if (!sel.length || busy) return;
    if (!probeTopic) { setErr(topicRequired); return; }
    setBusy(true); setErr(null); setAnswers(null); setMetrics(null); setCouncil(null); setBgMsg(false);
    if (!brandProp.trim() && typed.trim() && saveIt) {
      // Only fill an empty account brand; never overwrite the owner's identity with a scanned client name.
      try { const { data: u } = await supabase.auth.getUser(); if (u.user) await supabase.from("profiles").update({ brand_name: typed.trim().slice(0, 120) } as any).eq("id", u.user.id).is("brand_name", null); } catch {}
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await apiFetch("/api/visibility", {
        method: "POST",
        headers,
        body: JSON.stringify({ brand, keywords: probeTopic, lang: L, scope, probe_engines: sel, notify: mode !== "instant", background: mode === "background", workspace_id: workspaceId }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || j?.error === "auth_required") { setErr("__signin"); return; }
      if (!r.ok) { setErr(String(j?.[L] || j?.error || r.status)); return; }
      if (j?.background && !(j?.probe?.answers || []).length) { setBgMsg(true); return; }
      setAnswers(j?.probe?.answers || []); setCouncil(j?.probe?.council || null); setMetrics(j?.probe?.visibility_metrics || null);
    } catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(false); }
  }

  const cards: EngineAnswer[] = useMemo(() => (answers || []).map((a) => ({
    key: a.engine as EngineKey,
    basis: "measured",
    score: a.rank ? Math.max(10, 100 - (a.rank - 1) * 15) : 0,
    verdict: a.rank ? `${T.rank}: #${a.rank}` : T.miss,
    action: a.mentioned ? undefined : a.reason,
    text: a.answer,
    groundedReview: a.grounded_answer || (a.status === "partial" ? (L === "en" ? "Evidence review did not return; only the blind result is available." : L === "ku" ? "هەڵسەنگاندنی بەڵگە نەگەڕایەوە؛ تەنها ئەنجامی کوێرانە بەردەستە." : "لم تُرجع مراجعة الأدلة؛ المتاح هو نتيجة السبر الأعمى فقط.") : undefined),
    items: a.brands.slice(0, 5),
  })), [answers, L]);

  const pct = (metric?: ProbeMetricValue) => metric?.value_pct == null ? "—" : `${metric.value_pct.toFixed(metric.value_pct % 1 ? 2 : 0)}%`;
  const metricCards = metrics ? [
    { label: L === "en" ? "Engine response coverage" : L === "ku" ? "ڕێژەی وەڵامدانی بزوێنەر" : "تغطية تنفيذ المحركات", value: pct(metrics.engine_coverage), detail: `${metrics.answered_engines}/${metrics.requested_engines}` },
    { label: L === "en" ? "Brand mention rate" : L === "ku" ? "ڕێژەی هێنانی ناوی براند" : "معدل ذكر العلامة", value: pct(metrics.mention_rate), detail: `${metrics.mention_rate.numerator}/${metrics.mention_rate.denominator}` },
    { label: L === "en" ? "Recommendation rate" : L === "ku" ? "ڕێژەی پێشنیارکردن" : "معدل التوصية", value: pct(metrics.recommendation_rate), detail: `${metrics.recommendation_rate.numerator}/${metrics.recommendation_rate.denominator}` },
    { label: L === "en" ? "Share of voice" : L === "ku" ? "بەشی دەنگ" : "حصة الصوت", value: pct(metrics.share_of_voice), detail: `${metrics.share_of_voice.numerator}/${metrics.share_of_voice.denominator}` },
    { label: L === "en" ? "Evidence-matched citation rate" : L === "ku" ? "ڕێژەی ئاماژەی هاوتای بەڵگە" : "معدل الاستشهاد المطابق للأدلة", value: pct(metrics.citation_rate), detail: `${metrics.citation_rate.numerator}/${metrics.citation_rate.denominator}` },
    { label: L === "en" ? "Top-5 rate" : L === "ku" ? "ڕێژەی پلەی پێنجی یەکەم" : "معدل الظهور ضمن أول 5", value: pct(metrics.top5_rate), detail: `${metrics.top5_rate.numerator}/${metrics.top5_rate.denominator}` },
  ] : [];

  if (!brandProp.trim() && !allowBrandInput) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-card/50 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Radar className="size-4" /> {T.title}</div>
      <p className="text-xs text-muted-foreground">{L === "en" ? "Stage 1 asks for organic recommendations without your brand name. Stage 2 reviews the result against retrieved evidence. Cost preview includes both calls per engine." : L === "ku" ? "قۆناغی ١ پێشنیاری سروشتی بەبێ ناوی براندەکەت دەپرسی؛ قۆناغی ٢ ئەنجامەکە بە بەڵگە هەڵدەسەنگێنێت. تێچوو هەردوو پەیوەندییەکە بۆ هەر مۆدێلێک دەگرێتەوە." : "المرحلة الأولى تسأل عن توصيات طبيعية دون اسم علامتك، والثانية تراجع النتيجة مقابل الأدلة المستخرجة. معاينة التكلفة تشمل الاستدعاءين لكل محرك."}</p>
      {!brandProp.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={T.brandPh} className="flex-1 min-w-40 rounded-md border border-border bg-background px-2 py-1 text-xs" />
          <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} /> {T.save}</label>
        </div>
      )}
      <label className="block space-y-1 text-xs">
        <span>{L === "en" ? "Service or category to measure" : L === "ku" ? "خزمەتگوزاری یان پۆل" : "الخدمة أو الفئة المراد قياسها"}</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={L === "en" ? "e.g. digital marketing agencies in Beirut" : L === "ku" ? "نموونە: ئاژانسەکانی بازاڕکردنی دیجیتاڵ" : "مثال: وكالات التسويق الرقمي في بيروت"} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
      </label>
      <div className="flex flex-wrap gap-2">
        {ENGINES.map((e) => {
          const ok = allowed?.includes(e.key);
          const on = sel.includes(e.key);
          return (
            <button key={e.key} type="button" disabled={!ok} onClick={() => toggle(e.key)} title={ok ? e.name : T.locked}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition ${on ? "border-primary bg-primary/10" : "border-border bg-background/60"} ${ok ? "" : "opacity-40"}`}>
              <e.Logo size={16} /> {e.name} {!ok && <Lock className="size-3" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={() => setSel((allowed || []).slice(0, maxN))} className="rounded-md border border-border px-2 py-0.5">{T.all}</button>
        <button type="button" onClick={() => setSel([])} className="rounded-md border border-border px-2 py-0.5">{T.none}</button>
        {cost?.maxEngines ? <span className="text-muted-foreground">{T.max}: {cost.maxEngines}</span> : null}
        <span className="ms-auto">
          {cost && (cost.metered
            ? <>{T.cost}: <b className="font-mono">{cost.total.toLocaleString()}</b> · {T.bal}: <b className="font-mono">{cost.balance.toLocaleString()}</b></>
            : <span className="text-muted-foreground">{T.free}</span>)}
        </span>
      </div>
      {cost && !cost.enough && <div className="text-xs text-destructive">{T.low}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">{T.mode}</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
          <option value="instant">{T.instant}</option>
          {cost?.notifyAllowed !== false && <option value="notify">{T.notify}</option>}
          {cost?.backgroundAllowed !== false && <option value="background">{T.bg}</option>}
        </select>
        <button type="button" onClick={run} disabled={busy || !sel.length || !brand.trim() || (cost ? !cost.enough : false)}
          className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Radar className="size-3.5" />} {T.run} ({sel.length})
        </button>
      </div>
      {err === "__signin"
        ? <div className="text-xs text-destructive">{T.signIn} <a href="/auth" className="underline font-semibold">{T.login}</a></div>
        : err && <div className="text-xs text-destructive">{err}</div>}
      {bgMsg && <div className="text-xs text-primary">{T.bgOk}</div>}
      {metrics && (
        <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <div className="text-xs font-semibold text-primary">
            {L === "en" ? "Measured results from this run" : L === "ku" ? "ئەنجامی پێوانەکراوی ئەم جارە" : "النتائج المقاسة في هذا التشغيل"}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {metricCards.map((metric) => (
              <div key={metric.label} className="rounded-md border border-border bg-background/70 p-2">
                <div className="text-[10px] text-muted-foreground">{metric.label}</div>
                <div className="mt-1 text-xl font-bold tabular-nums">{metric.value}</div>
                <div className="text-[10px] text-muted-foreground">{metric.detail}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {L === "en"
              ? "Metrics describe only successful answers in this probe. Share of voice counts unique brand names returned in ranked brand lists; citation rate requires an answer URL to exactly match collected evidence. This API probe is not necessarily the consumer-facing engine UI."
              : L === "ku"
                ? "پێوەرەکان تەنها وەڵامە سەرکەوتووەکانی ئەم پشکنینە دەگرنەوە. بەشی دەنگ لە ناوەڕۆکی لیستی براندەکان هەژمار دەکرێت؛ ئاماژە بە سەرچاوە پێویستی بە هاوتایی URL لەگەڵ بەڵگەی کۆکراوە هەیە. ئەم API ـە بە پێویستی وەک ڕووکاری بەکارهێنەری بزوێنەر نییە."
                : "المؤشرات تخص الإجابات الناجحة في هذا الفحص فقط. حصة الصوت محسوبة من أسماء العلامات الفريدة في قوائم العلامات المرتبة؛ ومعدل الاستشهاد لا يحتسب إلا رابطاً أعاده النموذج ويطابق رابط دليل جُمع فعلياً. فحص API لا يطابق بالضرورة واجهة المحرك الموجهة للمستهلك."}
          </p>
        </div>
      )}
      {cards.length > 0 && <EngineResponseFlow answers={cards} title={T.res} compact />}
      {council && (
        <div className="rounded-lg border border-border bg-background/60 p-2 text-xs space-y-1">
          <div className="font-semibold text-primary">{L === "en" ? "Engines council" : L === "ku" ? "ئەنجومەنی بزوێنەرەکان" : "مجلس النماذج"}</div>
          <p>{council.agreement}</p>
          {council.disagreement && <p className="text-muted-foreground">{council.disagreement}</p>}
          <p className="font-semibold">{council.decision}</p>
        </div>
      )}
    </div>
  );
}
