import { useEffect, useState } from "react";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { ENGINE_CATALOG, type EngineKey } from "@/lib/ai-engines";
import type { EngineVerdict } from "@/lib/maaroof/tool-council";

export type Council = { engines: EngineVerdict[]; summary: { asked: number; answered: number; agree: number; disagree: number; avgScore: number | null; decision: string } };
type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

/** Counts up to the value once (respects reduced motion). */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0; const start = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - start) / 900); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

/** Animated circular score (0-100) drawn from the council average. */
export function GeoScoreRing({ value }: { value: number }) {
  const r = 20, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums"><CountUp to={v} /></span>
    </div>
  );
}

export function CouncilCards({ council, lang }: { council: Council; lang: L }) {
  const s = council.summary;
  const decision: Record<string, string> = {
    agree: tr(lang, "الأغلبية توافق على قابلية الاقتباس", "Majority would cite it", "زۆرینە ڕازین"),
    disagree: tr(lang, "الأغلبية لا تقتبسه بوضعه الحالي", "Majority would not cite it as is", "زۆرینە ڕازی نین"),
    split: tr(lang, "انقسام متساوٍ بين المحركات", "Engines are evenly split", "دابەشبوونی یەکسان"),
    no_evidence: tr(lang, "لم يُجب أي محرك — لا حكم", "No engine answered — no verdict", "هیچ وەڵامێک نییە"),
  };
  const glow = s.decision === "agree" ? "shadow-[0_0_24px_-8px_hsl(var(--primary))] border-primary/40" : s.decision === "disagree" ? "border-destructive/40" : "border-border/60";
  return (
    <div className={`mt-3 rounded-xl border bg-background/60 p-3 ${glow}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          {s.avgScore != null && <GeoScoreRing value={s.avgScore} />}
          <div>
            <div className="font-semibold">{tr(lang, "مجلس المحركات العشرة", "Ten-engine council", "ئەنجومەنی دە بزوێنەر")}</div>
            <div className="text-muted-foreground tabular-nums">{tr(lang, `أجاب ${s.answered} من ${s.asked}`, `${s.answered} of ${s.asked} answered`, `${s.answered} لە ${s.asked}`)}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {council.engines.map((e, i) => {
          const name = ENGINE_CATALOG[e.engine as EngineKey]?.name || e.engine;
          const ok = e.status === "answered";
          return (
            <div key={e.engine} title={ok ? e.note : e.reason} style={{ animationDelay: `${i * 60}ms` }} className="rb-workspace-fade rounded-lg border border-border/60 bg-card/60 p-2 text-[11px] motion-reduce:animate-none">
              <div className="flex items-center gap-1 font-semibold">
                {!ok ? <MinusCircle className="size-3 text-muted-foreground" /> : e.agree ? <CheckCircle2 className="size-3 text-primary" /> : <XCircle className="size-3 text-destructive" />}
                <span className="truncate">{name}</span>
              </div>
              <div className="mt-0.5 text-muted-foreground">{ok ? `${e.score}/100` : tr(lang, "لم يُجب", "No answer", "وەڵام نییە")}</div>
              {ok && e.note && <p className="mt-1 line-clamp-3 leading-4">{e.note}</p>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs font-medium">{decision[s.decision] || ""}</p>
    </div>
  );
}
