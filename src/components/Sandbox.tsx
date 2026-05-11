import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { Sparkles, Loader2, ShieldCheck, MapPin, Quote, Wand2, X, Lock, CheckCircle2, AlertCircle, Lightbulb, Bot, Tag } from "lucide-react";
import { PostSuggester } from "./PostSuggester";
import { ToolLangSelect } from "./ToolLangSelect";
import { ExportButtons } from "./ExportButtons";
import { ToolHelpBanner } from "./ToolHelpBanner";
import { GeoScopeSelector } from "./GeoScopeSelector";
import type { ExportPayload } from "@/lib/exports";
import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/lib/i18n";

type Result = {
  score: number; authority: number; local: number; citation: number;
  cached?: boolean;
  ai_view?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  keywords?: string[];
};

const STEPS = ["scan_tokenize", "scan_authority", "scan_local", "scan_citation"] as const;

export function Sandbox() {
  const { t, lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;

  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<Result | null>(null);
  const [askSuggest, setAskSuggest] = useState(false);
  const [showSuggester, setShowSuggester] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrialGate, setShowTrialGate] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [outLang, setOutLang] = useState<Lang>(lang);

  useEffect(() => {
    const onReuse = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string } | undefined;
      if (detail?.text) {
        setText(detail.text);
        setResult(null);
        setError(null);
      }
    };
    window.addEventListener("geo:reuse-analyze", onReuse);
    return () => window.removeEventListener("geo:reuse-analyze", onReuse);
  }, []);

  const run = async () => {
    if (!text.trim() || running) return;
    setError(null);
    setShowLimit(false);

    if (!user) {
      setShowTrialGate(true);
      return;
    }

    setRunning(true);
    setResult(null);
    setShowSuggester(false);
    setAskSuggest(false);

    const stepTimer = (async () => {
      for (let i = 0; i < STEPS.length; i++) {
        setStep(i);
        await new Promise((r) => setTimeout(r, 500));
      }
    })();

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session) headers.Authorization = `Bearer ${session.access_token}`;

      const r = await fetch("/api/analyze", {
        method: "POST", headers,
        body: JSON.stringify({ text, lang: outLang }),
      });
      const data = await r.json();
      await stepTimer;
      if (r.status === 402 && data.error === "limit") {
        setShowLimit(true);
      } else if (r.status === 401) {
        setShowTrialGate(true);
      } else if (!r.ok) {
        setError(data.error || "Error");
      } else {
        setResult(data);
        setAskSuggest(true);
        if (auth) auth.refreshProfile();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
      setStep(-1);
    }
  };

  const tier = !result ? "" : result.score >= 80 ? t("score_high") : result.score >= 55 ? t("score_mid") : t("score_low");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:p-6 md:p-8 glow-border">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span className="font-mono uppercase tracking-widest text-xs">{t("sandbox_title")}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("sandbox_desc")}</p>
      <ToolHelpBanner toolKey="analyze" />
      <div className="mt-3"><GeoScopeSelector compact toolKey="analyze" /></div>

      <div className="mb-3 flex justify-end">
        <ToolLangSelect value={outLang} onChange={setOutLang} />
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>{t("hint_paste")}</span>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("sandbox_placeholder")}
          rows={5}
          maxLength={8000}
          className="w-full resize-none rounded-xl border border-border bg-background/60 p-4 font-mono text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        {running && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="animate-scan h-1/3 w-full bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-mono text-muted-foreground">{text.trim().length} chars</div>
        <button
          onClick={run}
          disabled={running || !text.trim()}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {running ? t("sandbox_running") : t("sandbox_cta")}
        </button>
      </div>

      {(running || result) && (
        <div className="mt-6 space-y-2">
          {STEPS.map((s, i) => {
            const done = result !== null || i < step;
            const active = i === step;
            return (
              <div key={s} className="flex items-center gap-3 text-sm">
                <div className={`size-2 shrink-0 rounded-full transition ${done ? "bg-success" : active ? "bg-primary animate-pulse" : "bg-muted"}`} />
                <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{t(s)}</span>
                <div className="ms-auto h-1 w-20 overflow-hidden rounded-full bg-muted sm:w-32">
                  <div className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: done ? "100%" : active ? "60%" : "0%" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {showTrialGate && (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-center gap-2"><Lock className="size-5 text-primary" /><div className="font-semibold">{t("trial_title")}</div></div>
          <p className="text-sm text-muted-foreground">{t("trial_desc")}</p>
          <Link to="/auth" search={{ mode: "signup", redirect: "/" }} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
            {t("trial_signup")}
          </Link>
        </div>
      )}

      {showLimit && (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <div className="font-semibold">{t("limit_reached_title")}</div>
          <p className="text-sm text-muted-foreground">{t("limit_reached_desc")}</p>
          <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            {t("limit_view_plans")}
          </Link>
        </div>
      )}

      {result && (
        <>
          <div className="mt-7 flex justify-end">
            <ExportButtons size="xs" build={(): ExportPayload => ({
              title: t("export_analysis_title"),
              sections: [
                { kind: "kv", heading: t("score_label"), rows: [
                  [t("score_label"), `${result.score}/100`],
                  [t("metric_authority"), result.authority],
                  [t("metric_local"), result.local],
                  [t("metric_citation"), result.citation],
                ]},
                ...(result.ai_view ? [{ kind: "text" as const, heading: t("report_ai_view"), text: result.ai_view }] : []),
                ...(result.strengths?.length ? [{ kind: "list" as const, heading: t("report_strengths"), list: result.strengths }] : []),
                ...(result.weaknesses?.length ? [{ kind: "list" as const, heading: t("report_weaknesses"), list: result.weaknesses }] : []),
                ...(result.recommendations?.length ? [{ kind: "list" as const, heading: t("report_recommendations"), list: result.recommendations }] : []),
                ...(result.keywords?.length ? [{ kind: "list" as const, heading: t("report_keywords"), list: result.keywords }] : []),
                { kind: "text", heading: t("col_input"), text },
              ],
            })} />
          </div>
          <div className="mt-3 grid gap-5 md:grid-cols-[200px_1fr]">
            <Gauge value={result.score} label={t("score_label")} tier={tier} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              <Metric icon={<ShieldCheck className="size-4" />} label={t("metric_authority")} value={result.authority} />
              <Metric icon={<MapPin className="size-4" />} label={t("metric_local")} value={result.local} />
              <Metric icon={<Quote className="size-4" />} label={t("metric_citation")} value={result.citation} />
            </div>
          </div>

          {result.ai_view && (
            <div className="mt-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
                <Bot className="size-4" /> {t("report_ai_view")}
              </div>
              <p className="text-sm leading-relaxed text-foreground">{result.ai_view}</p>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {result.strengths && result.strengths.length > 0 && (
              <ReportList icon={<CheckCircle2 className="size-4 text-success" />} title={t("report_strengths")} items={result.strengths} tone="success" />
            )}
            {result.weaknesses && result.weaknesses.length > 0 && (
              <ReportList icon={<AlertCircle className="size-4 text-destructive" />} title={t("report_weaknesses")} items={result.weaknesses} tone="destructive" />
            )}
          </div>

          {result.recommendations && result.recommendations.length > 0 && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                <Lightbulb className="size-4" /> {t("report_recommendations")}
              </div>
              <ol className="ms-5 list-decimal space-y-1.5 text-sm text-foreground">
                {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}

          {result.keywords && result.keywords.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Tag className="size-3.5" /> {t("report_keywords")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.keywords.map((k, i) => (
                  <span key={i} className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs text-foreground">{k}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {result && askSuggest && !showSuggester && (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Wand2 className="mt-0.5 size-5 text-accent" />
            <div>
              <div className="text-sm font-semibold text-foreground">{t("ask_suggest_title")}</div>
              <div className="text-xs text-muted-foreground">{t("ask_suggest_desc")}</div>
            </div>
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <button onClick={() => setAskSuggest(false)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <X className="size-3" /> {t("ask_suggest_no")}
            </button>
            <button onClick={() => { setShowSuggester(true); setAskSuggest(false); }} className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="size-3" /> {t("ask_suggest_yes")}
            </button>
          </div>
        </div>
      )}

      {showSuggester && <div className="mt-5"><PostSuggester initialSourceText={text} compact /></div>}
    </div>
  );
}

function ReportList({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: "success" | "destructive" }) {
  const border = tone === "success" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5";
  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {title}
      </div>
      <ul className="space-y-1.5 text-sm text-foreground">
        {items.map((it, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-current opacity-50" /><span>{it}</span></li>)}
      </ul>
    </div>
  );
}

function Gauge({ value, label, tier }: { value: number; label: string; tier: string }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/40 p-4">
      <div className="relative size-40">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90">
          <circle cx="80" cy="80" r={r} stroke="oklch(0.28 0.03 250)" strokeWidth="10" fill="none" />
          <circle cx="80" cy="80" r={r} stroke="url(#g)" strokeWidth="10" fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease-out" }} />
          <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stopColor="oklch(0.78 0.18 195)" /><stop offset="100%" stopColor="oklch(0.62 0.22 295)" /></linearGradient></defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-4xl font-bold text-gradient">{value}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</div>
        </div>
      </div>
      <div className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{tier}</div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="text-primary">{icon}</span>{label}</div>
      <div className="mb-2 font-display text-2xl font-bold text-foreground">{value}</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${value}%` }} /></div>
    </div>
  );
}
