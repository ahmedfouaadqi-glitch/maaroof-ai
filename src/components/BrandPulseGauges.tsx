import { useEffect, useMemo, useState } from "react";
import { Activity, Gauge, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

/** SVG semicircular gauge (speedometer-style). value: 0..100 */
function Speedo({ value, label, hint, accent }: { value: number; label: string; hint: string; accent: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  // Semi-circle path from (10,90) to (190,90), radius 80
  const angle = (v / 100) * 180; // degrees, 0=left, 180=right
  const rad = ((180 - angle) * Math.PI) / 180;
  const cx = 100, cy = 90, r = 70;
  const nx = cx + r * Math.cos(rad);
  const ny = cy - r * Math.sin(rad);
  const tone = v >= 75 ? "text-emerald-500" : v >= 45 ? "text-amber-500" : "text-rose-500";
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-2">
        <Gauge className={`size-4 ${accent}`} />
        <div className="text-sm font-semibold">{label}</div>
      </div>
      <svg viewBox="0 0 200 110" className="mt-2 w-full">
        <defs>
          <linearGradient id={`g-${label}`} x1="0" x2="1">
            <stop offset="0%" stopColor="hsl(0 80% 55%)" />
            <stop offset="50%" stopColor="hsl(45 90% 55%)" />
            <stop offset="100%" stopColor="hsl(150 70% 45%)" />
          </linearGradient>
        </defs>
        <path d="M30 90 A70 70 0 0 1 170 90" fill="none" stroke={`url(#g-${label})`} strokeWidth="14" strokeLinecap="round" opacity="0.85" />
        {/* ticks */}
        {[0, 25, 50, 75, 100].map((tk) => {
          const a = ((180 - (tk / 100) * 180) * Math.PI) / 180;
          const x1 = cx + 78 * Math.cos(a), y1 = cy - 78 * Math.sin(a);
          const x2 = cx + 86 * Math.cos(a), y2 = cy - 86 * Math.sin(a);
          return <line key={tk} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" className="text-muted-foreground/60" />;
        })}
        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-foreground transition-all duration-700" />
        <circle cx={cx} cy={cy} r="5" className="fill-foreground" />
      </svg>
      <div className="mt-1 flex items-baseline justify-between">
        <div className={`font-mono text-2xl font-bold ${tone}`}>{v}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

type Metrics = { health: number; pulse: number; healthHint: string; pulseHint: string };

export function BrandPulseGauges() {
  const { user, profile } = useAuth();
  const { lang } = useI18n();
  const [m, setM] = useState<Metrics>({ health: 0, pulse: 0, healthHint: "…", pulseHint: "…" });
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string>("");

  const compute = async () => {
    if (!user) return;
    setLoading(true); setErr("");
    try {
      const p: any = profile || {};
      const completeness =
        (p.brand_name ? 12 : 0) +
        (p.brand_keywords ? 10 : 0) +
        (p.specialty ? 8 : 0) +
        (p.full_name ? 5 : 0) +
        (p.geo_scope && Object.keys(p.geo_scope || {}).length ? 5 : 0);

      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const [actsRes, runsRes, ansRes, sugRes] = await Promise.all([
        supabase.from("activity_log").select("action,created_at").eq("user_id", user.id).gte("created_at", since).limit(500),
        supabase.from("brand_boost_runs").select("created_at,report").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("analyses").select("score,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("suggestions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);

      const acts = actsRes.data || [];
      const actCount = acts.length;
      const distinct = new Set(acts.map((a: any) => a.action)).size;
      const activityScore = Math.min(30, distinct * 4 + Math.min(actCount, 14));

      const runs = runsRes.data || [];
      const runCount = runs.length;
      const runScore = Math.min(20, runCount * 4);
      const planLen = (r: any) => Array.isArray(r?.report?.plan) ? r.report.plan.length : 0;
      const lastRun = runs[0], prevRun = runs[1];
      const improvement = lastRun && prevRun ? Math.max(0, planLen(lastRun) - planLen(prevRun)) : 0;
      const trendScore = Math.min(10, improvement * 3 + (lastRun ? 4 : 0));

      const health = Math.min(100, completeness + activityScore + runScore + trendScore);

      const ans = ansRes.data || [];
      const sug = sugRes.data || [];
      const scored = ans.map((a: any) => Number(a.score || 0)).filter((n) => n > 0);
      const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
      const lastDate = ans[0]?.created_at ? new Date(ans[0].created_at).getTime()
        : sug[0]?.created_at ? new Date(sug[0].created_at).getTime()
        : runs[0]?.created_at ? new Date(runs[0].created_at).getTime() : 0;
      const ageDays = lastDate ? (Date.now() - lastDate) / 864e5 : 999;
      const freshness = ageDays < 1 ? 25 : ageDays < 7 ? 16 : ageDays < 30 ? 8 : 0;
      // engagement floor so the dial moves for active users even without scored analyses
      const engagement = Math.min(25, runCount * 5 + sug.length * 2);
      const pulse = Math.min(100, Math.round(avg * 0.7 + freshness + engagement));

      const healthHint =
        lang === "ar" ? `${runCount} جولة تعزيز · ${distinct} أدوات`
        : lang === "ku" ? `${runCount} جار · ${distinct} ئامراز`
        : `${runCount} boost runs · ${distinct} tools used`;
      const pulseHint = lastDate
        ? (lang === "ar" ? `${scored.length} تحليل · آخر نشاط قبل ${Math.round(ageDays)} يوم`
          : lang === "ku" ? `${scored.length} شیکاری · ${Math.round(ageDays)} ڕۆژ`
          : `${scored.length} analyses · last ${Math.round(ageDays)}d ago`)
        : (lang === "ar" ? "لا يوجد نشاط بعد" : lang === "ku" ? "هێشتا چالاکی نییە" : "no activity yet");

      setM({ health, pulse, healthHint, pulseHint });
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
    health: lang === "ar" ? "صحة العلامة التجارية" : lang === "ku" ? "تەندروستی برِاند" : "Brand Health",
    pulse:  lang === "ar" ? "نبض الظهور في الذكاء" : lang === "ku" ? "پەلپینی دیاربوون" : "AI Visibility Pulse",
    title:  lang === "ar" ? "مؤشرات لحظية" : lang === "ku" ? "نیشانە کاتییەکان" : "Real-time gauges",
    refresh: lang === "ar" ? "تحديث" : lang === "ku" ? "نوێکردن" : "Refresh",
    updated: lang === "ar" ? "آخر تحديث" : lang === "ku" ? "دوایین نوێکردن" : "updated",
  }), [lang]);

  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—";

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
      {err && <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{err}</div>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Speedo value={m.health} label={labels.health} hint={m.healthHint} accent="text-primary" />
        <Speedo value={m.pulse}  label={labels.pulse}  hint={m.pulseHint}  accent="text-accent" />
      </div>
    </div>
  );
}
