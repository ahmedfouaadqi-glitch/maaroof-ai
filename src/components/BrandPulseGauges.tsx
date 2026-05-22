import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Gauge, Info, RefreshCw, TrendingUp, TrendingDown, Minus, ArrowRight, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";

type Lang = "ar" | "ku" | "en";

type Breakdown = { key: string; label: string; value: number; max: number; source: string };
type Tip = { label: string; to?: string };

type MetricCard = {
  id: "health" | "pulse" | "velocity";
  value: number;
  label: string;
  hint: string;
  what: string;
  why: string;
  breakdown: Breakdown[];
  tips: Tip[];
  delta: number; // vs previous period
};

function tt(lang: Lang, ar: string, ku: string, en: string) {
  return lang === "ar" ? ar : lang === "ku" ? ku : en;
}

/** SVG semicircular gauge (speedometer-style). value: 0..100 */
function Speedo({
  value,
  label,
  hint,
  accent,
  delta,
  alarm,
  onInfo,
  onOpen,
  infoTip,
  lang,
}: {
  value: number;
  label: string;
  hint: string;
  accent: string;
  delta: number;
  alarm: boolean;
  onInfo: () => void;
  onOpen: () => void;
  infoTip: React.ReactNode;
  lang: Lang;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const angle = (v / 100) * 180;
  const rad = ((180 - angle) * Math.PI) / 180;
  const cx = 100, cy = 90, r = 70;
  const nx = cx + r * Math.cos(rad);
  const ny = cy - r * Math.sin(rad);
  const tone = v >= 75 ? "text-success" : v >= 45 ? "text-warning" : "text-destructive";
  const deltaIcon = delta > 0 ? <TrendingUp className="size-3" /> : delta < 0 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />;
  const deltaTone = delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground";
  const deltaText = `${delta > 0 ? "+" : ""}${delta}`;

  return (
    <div
      className={`group relative rounded-2xl border bg-background/40 p-4 transition-all cursor-pointer hover:border-primary/40 hover:bg-background/60 ${
        alarm ? "border-destructive/60 animate-pulse" : "border-border"
      }`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
    >
      <div className="flex items-center gap-2">
        <Gauge className={`size-4 ${accent}`} />
        <div className="text-sm font-semibold">{label}</div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onInfo(); }}
                className="ms-auto inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                aria-label="info"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
              {infoTip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <svg viewBox="0 0 200 110" className="mt-2 w-full">
        <defs>
          <linearGradient id={`g-${label}`} x1="0" x2="1">
            <stop offset="0%" stopColor="var(--destructive)" />
            <stop offset="50%" stopColor="var(--warning)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        <path d="M30 90 A70 70 0 0 1 170 90" fill="none" stroke={`url(#g-${label})`} strokeWidth="14" strokeLinecap="round" opacity="0.85" />
        {[0, 25, 50, 75, 100].map((tk) => {
          const a = ((180 - (tk / 100) * 180) * Math.PI) / 180;
          const x1 = cx + 78 * Math.cos(a), y1 = cy - 78 * Math.sin(a);
          const x2 = cx + 86 * Math.cos(a), y2 = cy - 86 * Math.sin(a);
          return <line key={tk} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" className="text-muted-foreground/60" />;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-foreground transition-all duration-700" />
        <circle cx={cx} cy={cy} r="5" className="fill-foreground" />
      </svg>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <div className={`font-mono text-2xl font-bold ${tone}`}>{v}</div>
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${deltaTone}`}>
            {deltaIcon}{deltaText}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground/80 opacity-0 transition-opacity group-hover:opacity-100">
        {tt(lang, "اضغط للتفاصيل والتوصيات", "کلیک بکە بۆ وردەکاری", "Click for details & tips")}
      </div>
    </div>
  );
}

export function BrandPulseGauges() {
  const { user, profile } = useAuth();
  const { lang } = useI18n();
  const [cards, setCards] = useState<MetricCard[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem("bpg_intro_seen");
  });
  const [alarms, setAlarms] = useState<Record<string, boolean>>({});
  const prevSnap = useRef<{ ts: number; v: Record<string, number> } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("bpg_last_snap");
      if (raw) prevSnap.current = JSON.parse(raw);
    } catch {}
  }, []);

  const compute = async () => {
    if (!user) return;
    setLoading(true); setErr("");
    try {
      const p: any = profile || {};
      // breakdown for health
      const cBrand = p.brand_name ? 6 : 0;
      const cKeys = p.brand_keywords ? 6 : 0;
      const cSpec = p.specialty ? 5 : 0;
      const cName = p.full_name ? 4 : 0;
      const cGeo = p.geo_scope && Object.keys(p.geo_scope || {}).length ? 4 : 0;
      const completeness = cBrand + cKeys + cSpec + cName + cGeo; // /25

      const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
      const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
      const since14 = new Date(Date.now() - 14 * 864e5).toISOString();

      const [actsRes, runsRes, ansRes, sugRes] = await Promise.all([
        supabase.from("activity_log").select("action,created_at").eq("user_id", user.id).gte("created_at", since30).limit(500),
        supabase.from("brand_boost_runs").select("created_at,report").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("analyses").select("score,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("suggestions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      const acts = actsRes.data || [];
      const runs = runsRes.data || [];
      const ans = ansRes.data || [];
      const sug = sugRes.data || [];

      const actCount = acts.length;
      const distinct = new Set(acts.map((a: any) => a.action)).size;
      const activityScore = Math.min(30, distinct * 4 + Math.min(actCount, 14));

      const runCount = runs.length;
      const runScore = Math.min(20, runCount * 4);

      const planLen = (r: any) => Array.isArray(r?.report?.plan) ? r.report.plan.length : 0;
      const lastRun = runs[0], prevRun = runs[1];
      const improvement = lastRun && prevRun ? Math.max(0, planLen(lastRun) - planLen(prevRun)) : 0;
      const trendScore = Math.min(10, improvement * 3 + (lastRun ? 4 : 0));

      const analysisCount = ans.length;
      const analysisScore = Math.min(15, analysisCount * 2);

      const health = Math.min(100, completeness + activityScore + runScore + analysisScore + trendScore);

      // pulse
      const scored = ans.map((a: any) => Number(a.score || 0)).filter((n) => n > 0);
      const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
      const lastDate = ans[0]?.created_at ? new Date(ans[0].created_at).getTime()
        : sug[0]?.created_at ? new Date(sug[0].created_at).getTime()
        : runs[0]?.created_at ? new Date(runs[0].created_at).getTime() : 0;
      const ageDays = lastDate ? (Date.now() - lastDate) / 864e5 : 999;
      const freshness = ageDays < 1 ? 25 : ageDays < 7 ? 16 : ageDays < 30 ? 8 : 0;
      const engagement = Math.min(25, runCount * 5 + sug.length * 2);
      const pulseScoreComp = Math.round(avg * 0.7);
      const pulse = Math.min(100, pulseScoreComp + freshness + engagement);

      // velocity: this week vs last week
      const thisWeekCount =
        acts.filter((a: any) => new Date(a.created_at).getTime() >= new Date(since7).getTime()).length +
        runs.filter((r: any) => new Date(r.created_at).getTime() >= new Date(since7).getTime()).length;
      const lastWeekStart = new Date(since14).getTime();
      const lastWeekEnd = new Date(since7).getTime();
      const lastWeekCount =
        acts.filter((a: any) => {
          const t = new Date(a.created_at).getTime();
          return t >= lastWeekStart && t < lastWeekEnd;
        }).length +
        runs.filter((r: any) => {
          const t = new Date(r.created_at).getTime();
          return t >= lastWeekStart && t < lastWeekEnd;
        }).length;
      const ratio = (thisWeekCount - lastWeekCount) / Math.max(lastWeekCount, 1);
      const velocity = Math.max(0, Math.min(100, Math.round(ratio * 50 + 50)));

      // deltas vs previous snapshot (~previous tick); fall back to weekly diff for velocity
      const prev = prevSnap.current?.v || {};
      const dHealth = prev.health != null ? Math.round(health - prev.health) : 0;
      const dPulse = prev.pulse != null ? Math.round(pulse - prev.pulse) : 0;
      const dVelocity = thisWeekCount - lastWeekCount;

      const healthBreakdown: Breakdown[] = [
        { key: "profile", label: tt(lang, "اكتمال الملف", "تەواوی پرۆفایل", "Profile completeness"), value: completeness, max: 25, source: tt(lang, "من إعدادات حسابك", "لە ڕێکخستنەکان", "from your profile settings") },
        { key: "activity", label: tt(lang, "نشاطك آخر 30 يوم", "چالاکی ٣٠ ڕۆژ", "Activity last 30 days"), value: activityScore, max: 30, source: tt(lang, `${actCount} إجراء · ${distinct} أدوات`, `${actCount} کردار`, `${actCount} actions · ${distinct} tools`) },
        { key: "runs", label: tt(lang, "جولات تعزيز العلامة", "جاری بەهێزکردن", "Brand boost runs"), value: runScore, max: 20, source: tt(lang, `${runCount} جولة`, `${runCount} جار`, `${runCount} runs`) },
        { key: "analyses", label: tt(lang, "تحليلات منجزة", "شیکارییەکان", "Completed analyses"), value: analysisScore, max: 15, source: tt(lang, `${analysisCount} تحليل`, `${analysisCount} شیکاری`, `${analysisCount} analyses`) },
        { key: "trend", label: tt(lang, "التحسّن بين الجولات", "گەشەکردن", "Improvement"), value: trendScore, max: 10, source: tt(lang, lastRun ? `+${improvement} بنود جديدة` : "لا توجد جولات بعد", lastRun ? `+${improvement} خاڵ` : "هیچ جارێک نییە", lastRun ? `+${improvement} new items` : "no runs yet") },
      ];

      const pulseBreakdown: Breakdown[] = [
        { key: "score", label: tt(lang, "متوسط درجات التحليل", "تێکڕای نمرە", "Avg analysis score"), value: pulseScoreComp, max: 70, source: tt(lang, scored.length ? `${scored.length} تحليل بدرجة` : "لا تحليلات مُسجَّلة", `${scored.length} شیکاری`, `${scored.length} scored analyses`) },
        { key: "fresh", label: tt(lang, "حداثة آخر نشاط", "نوێبوونی چالاکی", "Recency"), value: freshness, max: 25, source: lastDate ? tt(lang, `قبل ${Math.round(ageDays)} يوم`, `${Math.round(ageDays)} ڕۆژ`, `${Math.round(ageDays)}d ago`) : tt(lang, "لا نشاط", "هیچ", "no activity") },
        { key: "engage", label: tt(lang, "التفاعل العام", "بەژداری گشتی", "Engagement"), value: engagement, max: 25, source: tt(lang, `${runCount} جولة · ${sug.length} اقتراح`, `${runCount} جار`, `${runCount} runs · ${sug.length} suggestions`) },
      ];

      const velocityBreakdown: Breakdown[] = [
        { key: "this", label: tt(lang, "هذا الأسبوع", "ئەم هەفتە", "This week"), value: thisWeekCount, max: Math.max(thisWeekCount, lastWeekCount, 1), source: tt(lang, `${thisWeekCount} نشاط`, `${thisWeekCount} چالاکی`, `${thisWeekCount} activities`) },
        { key: "prev", label: tt(lang, "الأسبوع السابق", "هەفتەی پێشوو", "Previous week"), value: lastWeekCount, max: Math.max(thisWeekCount, lastWeekCount, 1), source: tt(lang, `${lastWeekCount} نشاط`, `${lastWeekCount} چالاکی`, `${lastWeekCount} activities`) },
      ];

      // Tips per metric based on weakest component
      const buildHealthTips = (): Tip[] => {
        const tips: Tip[] = [];
        if (completeness < 18) tips.push({ label: tt(lang, "أكمل بيانات علامتك التجارية", "پرۆفایل تەواو بکە", "Complete your brand profile"), to: "/profile" });
        if (activityScore < 18) tips.push({ label: tt(lang, "جرّب أداة جديدة من القائمة", "ئامرازێکی نوێ تاقیبکەرەوە", "Try a new tool from the menu"), to: "/dashboard" });
        if (runScore < 12) tips.push({ label: tt(lang, "شغّل جولة تعزيز للعلامة", "جارێکی بەهێزکردن دەستپێبکە", "Run a brand boost session"), to: "/dashboard" });
        if (analysisScore < 8) tips.push({ label: tt(lang, "شغّل تحليلاً جديداً الآن", "شیکارییەکی نوێ بکە", "Run a new analysis now"), to: "/dashboard" });
        if (tips.length === 0) tips.push({ label: tt(lang, "ممتاز! حافظ على وتيرتك", "زۆر باشە، بەردەوام بە", "Great pace — keep it up!") });
        return tips.slice(0, 3);
      };
      const buildPulseTips = (): Tip[] => {
        const tips: Tip[] = [];
        if (freshness < 16) tips.push({ label: tt(lang, "نفّذ نشاطاً اليوم لإنعاش النبض", "ئەمڕۆ کارێک بکە", "Do something today to refresh the pulse"), to: "/dashboard" });
        if (pulseScoreComp < 35) tips.push({ label: tt(lang, "حسّن المحتوى وأعد التحليل", "ناوەڕۆکەکە باشتر بکە", "Improve content and re-analyze"), to: "/dashboard" });
        if (engagement < 12) tips.push({ label: tt(lang, "جرّب اقتراحات المحتوى", "پێشنیاری ناوەڕۆک تاقیبکەرەوە", "Try content suggestions"), to: "/dashboard" });
        if (tips.length === 0) tips.push({ label: tt(lang, "نبضك قوي — استمر!", "پەلپینت بەهێزە", "Strong pulse — keep going!") });
        return tips.slice(0, 3);
      };
      const buildVelocityTips = (): Tip[] => {
        const tips: Tip[] = [];
        if (velocity < 50) {
          tips.push({ label: tt(lang, "نشاطك أبطأ من الأسبوع الماضي", "چالاکیت کەمتر بووە", "Activity slower than last week") });
          tips.push({ label: tt(lang, "حدّد هدفاً يومياً صغيراً", "ئامانجێکی ڕۆژانە دابنێ", "Set a small daily goal"), to: "/dashboard" });
        } else if (velocity > 60) {
          tips.push({ label: tt(lang, "تسارُع رائع — وثّق نتائجك", "زۆر باشە", "Great acceleration — document wins!") });
        } else {
          tips.push({ label: tt(lang, "وتيرة ثابتة — جرّب أداة جديدة لرفعها", "نوێ تاقیبکەرەوە", "Steady — try a new tool to push it") });
        }
        return tips.slice(0, 3);
      };

      const next: MetricCard[] = [
        {
          id: "health",
          value: health,
          delta: dHealth,
          label: tt(lang, "صحة العلامة التجارية", "تەندروستی برِاند", "Brand Health"),
          hint: tt(lang, `${runCount} جولة · ${distinct} أدوات`, `${runCount} جار`, `${runCount} runs · ${distinct} tools`),
          what: tt(lang, "مقياس شامل لقوة حضور علامتك بناءً على بياناتك ونشاطك.", "پێوەری گشتی هێزی برِاندت.", "Overall strength of your brand based on your data & activity."),
          why: tt(lang, "كلما ارتفع، زادت احتمالية ظهورك في نتائج الذكاء الاصطناعي.", "هەرچی بەرزتر، چالاکتری.", "Higher = more likely to surface in AI results."),
          breakdown: healthBreakdown,
          tips: buildHealthTips(),
        },
        {
          id: "pulse",
          value: pulse,
          delta: dPulse,
          label: tt(lang, "نبض الظهور في الذكاء", "پەلپینی دیاربوون", "AI Visibility Pulse"),
          hint: lastDate ? tt(lang, `آخر نشاط قبل ${Math.round(ageDays)} يوم`, `${Math.round(ageDays)} ڕۆژ`, `last ${Math.round(ageDays)}d ago`) : tt(lang, "لا نشاط بعد", "هێشتا نییە", "no activity yet"),
          what: tt(lang, "مدى حيوية وحداثة ظهورك مؤخراً.", "تازەیی دیاربوونت.", "How fresh and active your visibility is right now."),
          why: tt(lang, "النبض المنخفض يعني أن البيانات قديمة وقد تتراجع نتائجك.", "نزم = داتای کۆن.", "Low pulse = stale data and likely drop-off."),
          breakdown: pulseBreakdown,
          tips: buildPulseTips(),
        },
        {
          id: "velocity",
          value: velocity,
          delta: dVelocity,
          label: tt(lang, "سرعة النمو", "خێرایی گەشە", "Growth Velocity"),
          hint: tt(lang, `${thisWeekCount} مقابل ${lastWeekCount}`, `${thisWeekCount} / ${lastWeekCount}`, `${thisWeekCount} vs ${lastWeekCount}`),
          what: tt(lang, "مقارنة نشاطك هذا الأسبوع بالأسبوع الماضي.", "بەراوردی هەفتە.", "Your activity this week vs the previous week."),
          why: tt(lang, "50 = ثابت، أعلى = تسارع، أقل = تباطؤ.", "٥٠ = هاوسەنگ.", "50 = steady; higher = accelerating; lower = slowing."),
          breakdown: velocityBreakdown,
          tips: buildVelocityTips(),
        },
      ];

      // alarms: detect a drop of >15 vs previous snapshot in last 24h
      const newAlarms: Record<string, boolean> = {};
      if (prevSnap.current && Date.now() - prevSnap.current.ts < 864e5) {
        for (const c of next) {
          const prevV = prevSnap.current.v[c.id];
          if (prevV != null && prevV - c.value > 15) newAlarms[c.id] = true;
        }
      }
      setAlarms(newAlarms);

      // save snapshot
      const snap = { ts: Date.now(), v: { health, pulse, velocity } };
      prevSnap.current = snap;
      try { window.localStorage.setItem("bpg_last_snap", JSON.stringify(snap)); } catch {}

      setCards(next);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      setErr(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { compute(); /* eslint-disable-next-line */ }, [user, profile, tick, lang]);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const labels = useMemo(() => ({
    title: tt(lang, "مؤشرات لحظية", "نیشانە کاتییەکان", "Real-time gauges"),
    refresh: tt(lang, "تحديث", "نوێکردن", "Refresh"),
    updated: tt(lang, "آخر تحديث", "دوایین نوێکردن", "updated"),
    intro: tt(lang,
      "هذه الأرقام حقيقية ومُحتسبة من نشاطك الفعلي داخل الأدوات — ليست تقديرية. اضغط أي عدّاد لرؤية تفاصيله وكيفية رفعه.",
      "ئەم ژمارانە لە چالاکی ڕاستەقینەتەوەن. کلیک بکە بۆ وردەکاری.",
      "These numbers come from your real activity inside the tools — not estimates. Click any gauge to see how to improve it."
    ),
    gotIt: tt(lang, "فهمت", "تێگەیشتم", "Got it"),
    breakdownTitle: tt(lang, "تفكيك الرقم", "وردبوونەوەی ژمارە", "How this score breaks down"),
    deltaTitle: tt(lang, "مقارنة بالأسبوع الماضي", "بەراوردی هەفتە", "Compared to last week"),
    tipsTitle: tt(lang, "خطوات لرفع المؤشر", "هەنگاو بۆ بەرزکردنەوە", "Steps to improve"),
    open: tt(lang, "افتح الأداة", "بکەرەوە", "Open tool"),
  }), [lang]);

  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—";
  const openCard = cards.find((c) => c.id === openId) || null;

  const accentByIdx = ["text-primary", "text-accent", "text-warning"];

  return (
    <div className="rounded-2xl border border-primary/20 bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <div className="font-semibold text-sm">{labels.title}</div>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">· {labels.updated}: {updatedLabel}</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => setTick((x) => x + 1)}
          className="ms-auto inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> {labels.refresh}
        </button>
      </div>

      {showIntro && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-[11px] text-foreground/80 animate-fade-in">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <div className="flex-1 leading-relaxed">{labels.intro}</div>
          <button
            type="button"
            onClick={() => { setShowIntro(false); try { window.localStorage.setItem("bpg_intro_seen", "1"); } catch {} }}
            className="shrink-0 rounded-md border border-primary/30 bg-background/40 px-2 py-0.5 text-[10px] hover:bg-primary/10"
          >
            {labels.gotIt}
          </button>
        </div>
      )}

      {err && <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{err}</div>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <Speedo
            key={c.id}
            value={c.value}
            label={c.label}
            hint={c.hint}
            accent={accentByIdx[i] || "text-primary"}
            delta={c.delta}
            alarm={!!alarms[c.id]}
            onInfo={() => setOpenId(c.id)}
            onOpen={() => setOpenId(c.id)}
            lang={lang}
            infoTip={
              <div className="space-y-1.5">
                <div className="font-semibold">{c.label}</div>
                <div className="opacity-90">{c.what}</div>
                <div className="text-muted-foreground">{c.why}</div>
              </div>
            }
          />
        ))}
      </div>

      <Sheet open={!!openCard} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {openCard && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Gauge className="size-4 text-primary" />
                  {openCard.label}
                  <span className="ms-auto font-mono text-2xl font-bold">{Math.round(openCard.value)}</span>
                </SheetTitle>
                <SheetDescription className="text-start">{openCard.what} {openCard.why}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">{labels.deltaTitle}</div>
                <div className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${
                  openCard.delta > 0 ? "border-success/40 bg-success/10 text-success" :
                  openCard.delta < 0 ? "border-destructive/40 bg-destructive/10 text-destructive" :
                  "border-border bg-muted/30 text-muted-foreground"
                }`}>
                  {openCard.delta > 0 ? <TrendingUp className="size-3.5" /> : openCard.delta < 0 ? <TrendingDown className="size-3.5" /> : <Minus className="size-3.5" />}
                  {openCard.delta > 0 ? "+" : ""}{openCard.delta}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground">{labels.breakdownTitle}</div>
                {openCard.breakdown.map((b) => (
                  <div key={b.key} className="rounded-lg border border-border bg-background/40 p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-medium">{b.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">{b.value}/{b.max}</div>
                    </div>
                    <Progress value={Math.min(100, (b.value / Math.max(b.max, 1)) * 100)} className="mt-1.5 h-1.5" />
                    <div className="mt-1 text-[10px] text-muted-foreground">{b.source}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">{labels.tipsTitle}</div>
                {openCard.tips.map((t, i) => (
                  t.to ? (
                    <Link
                      key={i}
                      to={t.to}
                      onClick={() => setOpenId(null)}
                      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm hover:bg-primary/10 transition-colors"
                    >
                      <ArrowRight className="size-3.5 text-primary shrink-0 rtl:rotate-180" />
                      <span className="flex-1">{t.label}</span>
                      <span className="text-[10px] text-primary">{labels.open}</span>
                    </Link>
                  ) : (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2.5 text-sm text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                      {t.label}
                    </div>
                  )
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
