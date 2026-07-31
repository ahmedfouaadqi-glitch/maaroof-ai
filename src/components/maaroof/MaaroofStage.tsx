// MaaroofStage — interactive visual replacement for the raw JSON stream.
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { MaaroofGlobe } from "./MaaroofGlobe";
import { MatrixRain } from "./MatrixRain";
import { AgentPulse } from "@/components/agent/AgentPulse";
import { Bot, FileDown, Code2, CheckCircle2, XCircle, Brain, Wrench, Lightbulb, Sparkles } from "lucide-react";

export type StageEvent = { type: string; data: any; t: number };

type Props = {
  events: StageEvent[];
  running: boolean;
  geoMode: "auto" | "country" | "world";
  country?: string;
  detected?: { country?: string; city?: string } | null;
  finalText?: string;
  onExport?: () => void;
  onPickCountry?: (code: string) => void;
  /** User is typing the goal — pulses the agent ribbon before execution starts. */
  typing?: boolean;
};

const TOOL_ICON: Record<string, string> = {
  analyze: "🔎", suggest: "💡", compare: "⚖️", feasibility: "📊", bizdev: "💼",
  research: "📚", visibility: "👁️", brand_boost: "🚀", company_email: "✉️",
  applied_ranking: "🏆", geo_strategist: "🗺️", competitor_monitor: "🛰️",
  social_analysis: "📱", what_if: "🧪", brand_authority: "👑", geo_rewrite: "✍️",
};

export function MaaroofStage({ events, running, geoMode, country, detected, finalText, onExport, onPickCountry, typing }: Props) {
  const { t } = useI18n();
  const [showRaw, setShowRaw] = useState(false);

  const plan = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === "plan");
    return ev?.data?.plan?.steps as Array<{ tool: string; reason?: string; input?: any }> | undefined;
  }, [events]);

  const stepStatus = useMemo(() => {
    const map = new Map<number, { ok?: boolean; output?: any }>();
    for (const e of events) {
      if (e.type === "tool_result" && typeof e.data?.index === "number") {
        map.set(e.data.index, { ok: !!e.data.ok, output: e.data.output });
      }
    }
    return map;
  }, [events]);

  const phase = useMemo(() => {
    const last = [...events].reverse().find((e) => e.type === "phase");
    return last?.data?.phase as string | undefined;
  }, [events]);

  const reflections = events.filter((e) => e.type === "reflection");
  const lastReflection = reflections[reflections.length - 1]?.data?.text as string | undefined;

  const highlight = geoMode === "auto" ? detected?.country : geoMode === "country" ? country : undefined;
  const worldMode = geoMode === "world";

  const intensity = Math.min(1, (plan?.length || 1) / 8);

  return (
    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-b from-background to-card min-h-[420px]">
      {/* Matrix backdrop */}
      <MatrixRain active={running} intensity={running ? intensity : 0.15} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />






      <div className="relative grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 p-4">
        {/* Globe + status */}
        <div className="flex flex-col items-center">
          <MaaroofGlobe highlightCountry={highlight} worldMode={worldMode} size={280} onPickCountry={onPickCountry} />
          <div className="text-center mt-2 text-xs text-muted-foreground">
            {worldMode ? t("auto.global_scope") : highlight ? `الإضاءة: ${highlight}${detected?.city && geoMode === "auto" ? ` · ${detected.city}` : ""}` : t("auto.not_discovered_yet")}
          </div>
          <PhasePill phase={phase} running={running} />
        </div>

        {/* Steps orbit / cards */}
        <div className="relative space-y-3">
          {/* Agent activity — strands trace the word معروف while Maaroof works */}
          <div className={`absolute inset-x-0 top-0 z-0 transition-opacity duration-500 ${plan || finalText ? "opacity-25" : "opacity-100"}`}>
            <AgentPulse
              variant="word"
              events={events}
              running={running}
              typing={typing}
              settled={!!finalText}
              height={plan || finalText ? 120 : 200}
            />
          </div>
          <div className="relative z-10 space-y-3">
          {!plan && !running && events.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>مرحباً، أنا <strong className="text-foreground">{t("auto.maaroof_2")}</strong>{t("auto.define_your_goal_and_i_will")}</p>
            </div>
          )}

          {!plan && running && (
            <div className="text-center py-10 animate-pulse">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm">{t("auto.i_analyze_your_goal_and_build")}</p>
            </div>
          )}

          {plan && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plan.map((step, i) => {
                const st = stepStatus.get(i);
                const running_ = !st && running;
                const ok = st?.ok;
                const fail = st && !st.ok;
                return (
                  <div key={i} className={[
                    "rounded-lg border p-3 text-xs transition-all",
                    ok ? "border-green-500/40 bg-green-500/5" : fail ? "border-destructive/40 bg-destructive/5" : running_ ? "border-amber-500/40 bg-amber-500/5 animate-pulse" : "border-border bg-card/60",
                  ].join(" ")}>
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <span className="text-lg leading-none">{TOOL_ICON[step.tool] || "🔧"}</span>
                      <span className="flex-1 truncate">{step.tool}</span>
                      {ok && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {fail && <XCircle className="w-4 h-4 text-destructive" />}
                      {running_ && <Wrench className="w-4 h-4 text-amber-500 animate-spin" />}
                    </div>
                    {step.reason && <div className="text-muted-foreground line-clamp-2 mb-1">{step.reason}</div>}
                    {fail && st?.output?.error && <div className="text-destructive line-clamp-2">⚠ {String(st.output.error)}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {lastReflection && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold mb-1 text-purple-400"><Brain className="w-4 h-4" /> تأمل</div>
              <div className="whitespace-pre-wrap text-muted-foreground">{lastReflection}</div>
            </div>
          )}

          <ConflictCard events={events} />
          <TimingChip events={events} />
          <ComplianceCard events={events} />


          {finalText && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-semibold text-primary"><Lightbulb className="w-4 h-4" /> {t("auto.final_answer")}</div>
                {onExport && (
                  <button onClick={onExport} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><FileDown className="w-3 h-3" /> تصدير PDF</button>
                )}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{finalText}</div>
              <TrustPanel events={events} />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={() => setShowRaw((s) => !s)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"><Code2 className="w-3 h-3" /> {showRaw ? t("auto.hide_raw_log") : t("auto.view_raw_history_json")}</button>
          </div>

          {showRaw && (
            <pre className="text-[10px] bg-muted/40 border rounded p-2 max-h-72 overflow-auto whitespace-pre-wrap">
              {events.map((e) => `[${e.type}] ${JSON.stringify(e.data).slice(0, 400)}`).join("\n")}
            </pre>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhasePill({ phase, running }: { phase?: string; running: boolean }) {
  const { t } = useI18n();
  if (!running && !phase) return null;
  const label = phase === "planning" ? t("auto.planning_2") : phase === "summarizing" ? t("auto.formulating_answer") : phase === "loading_history" ? t("auto.loading_session") : running ? t("auto.working") : phase || "";
  return <div className="mt-3 text-[11px] px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">{label}</div>;
}

/** Part 7 — Strategic Time Engine verdict chip. */
function TimingChip({ events }: { events: StageEvent[] }) {
  const t = [...events].reverse().find((e) => e.type === "timing")?.data as any;
  if (!t?.verdict) return null;
  const LABEL: Record<string, string> = {
    execute_now: t("auto.execute_now"), delay: t("auto.postpone"), schedule: t("auto.scheduling"), observe: t("auto.monitoring"), cancel: t("auto.cancel"),
  };
  const tone = t.verdict === "execute_now" ? "border-green-500/40 bg-green-500/5 text-green-500"
    : t.verdict === "cancel" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-amber-500/40 bg-amber-500/5 text-amber-500";
  return (
    <div className={`rounded-lg border p-3 text-xs ${tone}`}>
      <div className="font-semibold mb-1">قرار التوقيت: {LABEL[t.verdict] || t.verdict}</div>
      {t.reason && <div className="text-muted-foreground">{t.reason}</div>}
    </div>
  );
}

/** Part 8 — Constitutional compliance (30 Laws of Cognitive Intelligence). */
function ComplianceCard({ events }: { events: StageEvent[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const c = [...events].reverse().find((e) => e.type === "compliance")?.data as any;
  if (!c) return null;
  const tone = c.verdict === "violation" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : c.verdict === "warning" ? "border-amber-500/40 bg-amber-500/5 text-amber-500"
    : "border-green-500/40 bg-green-500/5 text-green-500";
  const label = c.verdict === "violation" ? t("auto.mandatory_law_violation") : c.verdict === "warning" ? t("auto.constitutional_notes") : t("auto.committed_to_the_constitution");
  const violations: any[] = Array.isArray(c.violations) ? c.violations : [];
  return (
    <div className={`rounded-lg border p-3 text-xs ${tone}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-start font-semibold">
        الامتثال الدستوري: {label} — {c.score}% ({c.satisfied?.length ?? 0}/{c.checked} قانون)
      </button>
      {open && violations.length > 0 && (
        <ul className="list-disc ms-4 mt-2 space-y-1 text-muted-foreground">
          {violations.map((v, i) => (
            <li key={i}>
              <span className="font-medium">{v.ar}</span>
              {v.severity === "hard" && <span className="ms-1 text-[10px] rounded px-1 border border-destructive/50">{t("auto.mandatory")}</span>}
              <span className="block">{v.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Part 7 — Cognitive Conflict Engine resolution card. */

function ConflictCard({ events }: { events: StageEvent[] }) {
  const { t } = useI18n();
  const c = [...events].reverse().find((e) => e.type === "conflict")?.data as any;
  if (!c) return null;
  return (
    <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-xs">
      <div className="font-semibold mb-1 text-orange-400">{t("auto.resolve_cognitive_conflict")}</div>
      {c.why && <div className="text-muted-foreground mb-1">{c.why}</div>}
      {c.chosen && <div className="text-muted-foreground">الموقف المعتمد: <span className="font-mono">{c.chosen}</span></div>}
      {c.residual_risk && <div className="text-muted-foreground">مخاطرة متبقية: {c.residual_risk}</div>}
    </div>
  );
}

/** Part 7 — Trust Engine: why this recommendation. */
function TrustPanel({ events }: { events: StageEvent[] }) {
  const [open, setOpen] = useState(false);
  const t = [...events].reverse().find((e) => e.type === "trust")?.data as any;
  if (!t) return null;
  const List = ({ label, items }: { label: string; items?: any[] }) =>
    Array.isArray(items) && items.length ? (
      <div className="mb-2">
        <div className="font-semibold text-foreground/80">{label}</div>
        <ul className="list-disc ms-4 text-muted-foreground">
          {items.slice(0, 6).map((x, i) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x).slice(0, 160)}</li>)}
        </ul>
      </div>
    ) : null;
  return (
    <div className="mt-3 border-t border-border/50 pt-2 text-xs">
      <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground hover:text-foreground">
        {open ? t("auto.hide") : t("auto.why_this_recommendation")}{typeof t.confidence === "number" ? ` — ثقة ${t.confidence}%` : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          <List label={t("auto.evidence")} items={t.evidence} />
          <List label={t("auto.assumptions")} items={t.assumptions} />
          <List label={t("auto.limits")} items={t.limitations} />
          <List label={t("auto.alternatives")} items={t.alternatives} />
          <List label={t("auto.risks_2")} items={t.risks} />
          {t.expected_outcome && (
            <div><span className="font-semibold text-foreground/80">النتيجة المتوقعة: </span><span className="text-muted-foreground">{t.expected_outcome}</span></div>
          )}
          {Array.isArray(t.evidence_graph) && t.evidence_graph.length > 0 && (
            <div className="pt-1">
              <div className="font-semibold text-foreground/80">{t("auto.guides_grid")}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {t.evidence_graph.slice(0, 16).map((n: any, i: number) => (
                  <span key={i} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground" title={n.detail || ""}>
                    {n.kind}:{n.ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
