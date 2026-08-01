// Part 19.2–19.7 — Reality Lab panel.
// Rendered inside the existing Reality Center (no new dashboard page).
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2, RefreshCw, Play, Check, Network, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getRealityLab,
  getArchitecturalAudit,
  planExecution,
  decideExecution,
  runExecutionNow,
} from "@/lib/maaroof-execution.functions";

type Tab = "executions" | "evidence" | "benchmarks" | "experiments" | "audit";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  wired: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  idle: "bg-muted text-muted-foreground border-border",
  done: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  simulated: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  partial: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function RealityLabSection() {
  const { t } = useI18n();
  const load = useServerFn(getRealityLab);
  const loadAudit = useServerFn(getArchitecturalAudit);
  const plan = useServerFn(planExecution);
  const decide = useServerFn(decideExecution);
  const run = useServerFn(runExecutionNow);

  const [tab, setTab] = useState<Tab>("executions");
  const [data, setData] = useState<any>(null);
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setData(await load());
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (tab !== "audit" || audit) return;
    (async () => {
      try {
        setAudit(await loadAudit());
      } catch (e: any) {
        toast.error(String(e?.message || e));
      }
    })();
  }, [tab]);

  const onPlan = async () => {
    const g = goal.trim();
    if (g.length < 4) return;
    setBusy(true);
    try {
      await plan({ data: { goal: g, mode: "simulation" } });
      setGoal("");
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="p-6 text-center">
        <Loader2 className="size-4 animate-spin inline" />
      </div>
    );
  if (!data) return null;

  const tabs: Array<[Tab, string]> = [
    ["executions", t("auto.executions")],
    ["evidence", t("auto.evidence")],
    ["benchmarks", t("auto.benchmarks")],
    ["experiments", t("auto.experiments")],
    ["audit", t("auto.architecture_audit")],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("auto.reality_lab")}</h3>
        <button
          onClick={() => { setLoading(true); setAudit(null); void refresh(); }}
          className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] hover:bg-muted/40"
        >
          <RefreshCw className="size-3" /> {t("auto.refresh")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full border px-3 py-1 text-[11px] transition ${tab === k ? "border-primary/40 bg-primary/10 text-primary font-semibold" : "border-border/60 text-muted-foreground hover:bg-muted/40"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "executions" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label={t("auto.executions")} value={data.executions.total} />
            <Stat label={t("auto.avg_outcome")} value={`${data.executions.avg_outcome}%`} />
            <Stat label={t("auto.awaiting_approval")} value={data.executions.awaiting_approval} />
            <Stat label="USD" value={data.executions.total_cost_usd} />
          </div>

          <div className="flex gap-2">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="هدف تنفيذي…"
              className="flex-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs"
            />
            <button
              disabled={busy || goal.trim().length < 4}
              onClick={() => void onPlan()}
              className="rounded-xl bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : t("auto.plan")}
            </button>
          </div>

          <div className="space-y-1.5">
            {!data.executions.recent.length && <div className="text-[11px] text-muted-foreground">{t("auto.no_data_yet")}</div>}
            {data.executions.recent.map((e: any) => (
              <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE[e.status] || TONE.idle}`}>{e.status}</span>
                <span className="flex-1 truncate text-[11px]">{e.goal}</span>
                <span className="text-[11px] text-muted-foreground">{e.mode}</span>
                {e.outcome_score != null && <span className="text-[11px]">{e.outcome_score}%</span>}
                {e.approval_required && !e.approved_at && (
                  <button
                    disabled={busy}
                    onClick={() => void act(() => decide({ data: { executionId: e.id, decision: "approve" } }))}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-500"
                  >
                    <Check className="size-3" /> {t("auto.approve")}
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => void act(() => run({ data: { executionId: e.id } }))}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-0.5 text-[10px]"
                >
                  <Play className="size-3" /> {t("auto.run")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "evidence" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label={t("auto.evidence")} value={data.evidence.total} />
            <Stat label={t("auto.independent_sources")} value={data.evidence.validation.independent_sources} />
            <Stat label={t("auto.contradictions")} value={data.evidence.validation.contradicting} />
            <Stat label={t("auto.avg_evidence")} value={`${data.evidence.validation.weighted_score}%`} />
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            <Bar label={t("auto.avg_evidence")} value={data.evidence.validation.weighted_score} />
            <Bar label={t("auto.avg_verification")} value={data.evidence.validation.agreement} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.evidence.by_type || {}).map(([k, v]) => (
              <span key={k} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                {k}: {String(v)}
              </span>
            ))}
            {!Object.keys(data.evidence.by_type || {}).length && (
              <span className="text-[11px] text-muted-foreground">{t("auto.no_data_yet")}</span>
            )}
          </div>
        </div>
      )}

      {tab === "benchmarks" && (
        <div className="space-y-1.5">
          {!data.benchmarks.items.length && <div className="text-[11px] text-muted-foreground">{t("auto.no_data_yet")}</div>}
          {data.benchmarks.items.map((b: any) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2 text-[11px]">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{b.subject_kind}</span>
              <span className="flex-1 truncate">{b.subject} · {b.metric}</span>
              <span>{b.latest ?? "—"} {b.unit || ""}</span>
              <span className={b.improvement >= 0 ? "text-emerald-500" : "text-destructive"}>{b.improvement > 0 ? "+" : ""}{b.improvement}%</span>
              <span className="text-muted-foreground">{b.pass_rate}%</span>
            </div>
          ))}
        </div>
      )}

      {tab === "experiments" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Stat label={t("auto.experiments")} value={data.lab.total} />
            <Stat label={t("auto.reproduced")} value={data.lab.reproduced} />
            <Stat label={t("auto.avg_confidence")} value={`${data.lab.avg_confidence}%`} />
          </div>
          <div className="space-y-1.5">
            {!data.lab.recent.length && <div className="text-[11px] text-muted-foreground">{t("auto.no_data_yet")}</div>}
            {data.lab.recent.map((x: any) => (
              <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2 text-[11px]">
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]">{x.status}</span>
                <span className="flex-1 truncate">{x.title}</span>
                <span>{x.confidence}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-3">
          <QualityRegisterPanel />
          {!audit && (
            <div className="p-6 text-center">
              <Loader2 className="size-4 animate-spin inline" />
            </div>
          )}
          {audit && (
            <>
              <div className="rounded-2xl border border-border/60 bg-card/50 p-3 text-[11px] leading-relaxed">{audit.summary}</div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Stat label={t("auto.readiness")} value={`${audit.readiness.score}%`} />
                <Stat label={t("auto.coverage")} value={`${audit.coverage}%`} />
                <Stat label={t("auto.engines")} value={audit.engines.length} />
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {audit.readiness.dimensions.map((d: any) => (
                  <Bar key={d.key} label={d.label_ar} value={d.score} />
                ))}
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Network className="size-3 text-primary" /> {t("auto.engines")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {audit.engines.map((e: any) => (
                    <span key={e.key} className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE[e.state]}`} title={`الجزء ${e.part} · ${e.rows}`}>
                      {e.label_ar}
                    </span>
                  ))}
                </div>
              </div>

              {!!audit.gaps.length && (
                <div className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <AlertTriangle className="size-3 text-amber-500" /> {t("auto.gaps")}
                  </div>
                  {audit.gaps.slice(0, 10).map((g: any, i: number) => (
                    <div key={`${g.engine}-${i}`} className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE[g.severity]}`}>{g.severity}</span>
                      <span className="font-medium">{g.label_ar}</span>
                      <span className="flex-1 truncate text-muted-foreground">{g.issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {!!audit.roadmap.length && (
                <div className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-muted-foreground">{t("auto.roadmap")}</div>
                  {audit.roadmap.map((p: any) => (
                    <div key={p.phase} className="space-y-0.5">
                      <div className="text-[11px] font-medium text-primary">{p.phase}</div>
                      {p.items.map((i: string, k: number) => (
                        <div key={k} className="text-[11px] text-muted-foreground">· {i}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Continuous quality register — audit findings tracked to verification. */
function QualityRegisterPanel() {
  const { lang } = useI18n();
  const L = (x: L3) => x[(lang === "en" || lang === "ku" ? lang : "ar") as keyof L3];
  const counts = qualityCounts();
  const [openId, setOpenId] = useState<string | null>(null);
  const labels =
    lang === "en"
      ? { title: "Quality register", resolved: "Resolved", open: "Open", accepted: "Accepted", cause: "Root cause", impact: "Impact", fix: "Fix", verify: "Verification" }
      : lang === "ku"
        ? { title: "تۆمارى جۆرى", resolved: "چارەسەرکراو", open: "کراوە", accepted: "پەسەندکراو", cause: "هۆکار", impact: "کاریگەری", fix: "چارەسەر", verify: "پشکنین" }
        : { title: "سجل الجودة", resolved: "مُعالَجة", open: "مفتوحة", accepted: "مقبولة", cause: "السبب الجذري", impact: "الأثر", fix: "الإصلاح", verify: "التحقق" };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <ShieldCheck className="size-3 text-primary" /> {labels.title}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE.done}`}>{labels.resolved}: {counts.resolved}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE.medium}`}>{labels.open}: {counts.open}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE.low}`}>{labels.accepted}: {counts.accepted}</span>
      </div>

      <ul className="space-y-1.5">
        {QUALITY_REGISTER.map((f) => {
          const on = openId === f.id;
          return (
            <li key={f.id} className="rounded-xl border border-border/50 bg-background/40">
              <button
                type="button"
                onClick={() => setOpenId(on ? null : f.id)}
                aria-expanded={on}
                className="flex w-full flex-wrap items-center gap-2 p-2 text-start text-[11px]"
              >
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE[f.severity]}`}>{f.severity}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${f.status === "resolved" ? TONE.done : f.status === "open" ? TONE.medium : TONE.low}`}>
                  {f.status === "resolved" ? labels.resolved : f.status === "open" ? labels.open : labels.accepted}
                </span>
                <span className="flex-1 font-medium">{L(f.title)}</span>
              </button>
              {on && (
                <dl className="space-y-1 border-t border-border/50 p-2 text-[11px] leading-relaxed">
                  <div><dt className="inline font-semibold text-muted-foreground">{labels.cause}: </dt><dd className="inline">{L(f.cause)}</dd></div>
                  <div><dt className="inline font-semibold text-muted-foreground">{labels.impact}: </dt><dd className="inline">{L(f.impact)}</dd></div>
                  <div><dt className="inline font-semibold text-muted-foreground">{labels.fix}: </dt><dd className="inline">{L(f.fix)}</dd></div>
                  <div><dt className="inline font-semibold text-muted-foreground">{labels.verify}: </dt><dd className="inline">{L(f.verification)}</dd></div>
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
