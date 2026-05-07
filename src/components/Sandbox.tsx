import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Sparkles, Loader2, ShieldCheck, MapPin, Quote, Wand2, X } from "lucide-react";
import { PostSuggester } from "./PostSuggester";

type Result = { score: number; authority: number; local: number; citation: number };

const STEPS = ["scan_tokenize", "scan_authority", "scan_local", "scan_citation"] as const;

function pseudoScore(text: string): Result {
  // deterministic-ish "demo" scoring for the teaser
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  const base = 38 + (h % 45);
  const lenBonus = Math.min(15, Math.floor(text.trim().split(/\s+/).length / 12));
  const score = Math.min(96, base + lenBonus);
  const jitter = (n: number) => Math.max(20, Math.min(98, score + ((h >> n) % 18) - 9));
  return { score, authority: jitter(3), local: jitter(7), citation: jitter(11) };
}

export function Sandbox() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    if (!text.trim() || running) return;
    setRunning(true);
    setResult(null);
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 650));
    }
    setResult(pseudoScore(text));
    setRunning(false);
    setStep(-1);
  };

  const tier =
    !result ? "" : result.score >= 80 ? t("score_high") : result.score >= 55 ? t("score_mid") : t("score_low");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-6 shadow-[var(--shadow-elevated)] backdrop-blur-xl md:p-8 glow-border">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span className="font-mono uppercase tracking-widest text-xs">{t("sandbox_title")}</span>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{t("sandbox_desc")}</p>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("sandbox_placeholder")}
          rows={5}
          className="w-full resize-none rounded-xl border border-border bg-background/60 p-4 font-mono text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        {running && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="animate-scan h-1/3 w-full bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-mono text-muted-foreground">
          {text.trim().length} chars
        </div>
        <button
          onClick={run}
          disabled={running || !text.trim()}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {running ? t("sandbox_running") : t("sandbox_cta")}
        </button>
      </div>

      {/* progress steps */}
      {(running || result) && (
        <div className="mt-6 space-y-2">
          {STEPS.map((s, i) => {
            const done = result !== null || i < step;
            const active = i === step;
            return (
              <div key={s} className="flex items-center gap-3 text-sm">
                <div
                  className={`size-2 rounded-full transition ${
                    done ? "bg-success" : active ? "bg-primary animate-pulse" : "bg-muted"
                  }`}
                />
                <span className={done || active ? "text-foreground" : "text-muted-foreground"}>
                  {t(s)}
                </span>
                <div className="ms-auto h-1 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                    style={{ width: done ? "100%" : active ? "60%" : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result && (
        <div className="mt-7 grid gap-5 md:grid-cols-[200px_1fr]">
          <Gauge value={result.score} label={t("score_label")} tier={tier} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            <Metric icon={<ShieldCheck className="size-4" />} label={t("metric_authority")} value={result.authority} />
            <Metric icon={<MapPin className="size-4" />} label={t("metric_local")} value={result.local} />
            <Metric icon={<Quote className="size-4" />} label={t("metric_citation")} value={result.citation} />
            <div className="sm:col-span-3 md:col-span-1 lg:col-span-3">
              <button className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20">
                {t("score_unlock")} →
              </button>
            </div>
          </div>
        </div>
      )}
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
          <circle
            cx="80" cy="80" r={r}
            stroke="url(#g)" strokeWidth="10" fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
          <defs>
            <linearGradient id="g" x1="0" x2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.18 195)" />
              <stop offset="100%" stopColor="oklch(0.62 0.22 295)" />
            </linearGradient>
          </defs>
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
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mb-2 font-display text-2xl font-bold text-foreground">{value}</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
