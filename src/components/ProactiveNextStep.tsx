// Proactive next-step CTA card. Shown beneath any tool result after cognition
// has detected an intent + suggested next action.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { runCognition } from "@/lib/cognition.functions";
import { useI18n } from "@/lib/i18n";
import { sendHandoff, type HandoffTarget, HANDOFF_LABELS } from "@/lib/tool-handoff";
import { toolLabel } from "@/lib/tool-catalog";

type Props = {
  toolKey: string;
  inputSummary?: string;
  outputSummary?: string;
  /** Optional text that the next tool can use as its input. */
  handoffText?: string;
  /** Hide entirely (e.g. when output is empty). */
  hidden?: boolean;
};

// Map cognition next_tool keys to existing handoff targets.
const HANDOFF_MAP: Record<string, HandoffTarget> = {
  analyze: "analyze",
  suggest: "suggest",
  research: "research",
  feasibility: "feasibility",
  bizdev: "bizdev",
  compare: "compare",
  company_email: "outreach",
  brand_boost: "boost",
  applied_ranking: "applied",
};

export function ProactiveNextStep({ toolKey, inputSummary, outputSummary, handoffText, hidden }: Props) {
  const { lang } = useI18n();
  const callRun = useServerFn(runCognition);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<any>(null);

  useEffect(() => {
    if (hidden || !outputSummary) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    callRun({ data: { toolKey, inputSummary, outputSummary } })
      .then((r) => { if (!cancelled) setIntent((r as any)?.intent || null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolKey, outputSummary]);

  if (hidden) return null;
  if (loading) {
    return (
      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {lang === "ar" ? "تحليل النية…" : lang === "ku" ? "شیکاری مەبەست…" : "Detecting intent…"}
      </div>
    );
  }
  if (!intent || !intent.next_tool) return null;

  const target = HANDOFF_MAP[intent.next_tool] || null;
  const targetLabel = target
    ? HANDOFF_LABELS[target][lang as "ar" | "en" | "ku"]
    : toolLabel(intent.next_tool, lang as any);
  const reason = (intent[`next_reason_${lang}`] as string) || intent.next_reason_en || "";

  const urgencyColor =
    intent.urgency === "high" ? "border-destructive/40 bg-destructive/5"
    : intent.urgency === "medium" ? "border-warning/40 bg-warning/5"
    : "border-primary/30 bg-primary/5";

  return (
    <div className={`mt-4 rounded-xl border ${urgencyColor} p-4`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
        <Sparkles className="size-4" />
        {lang === "ar" ? "الخطوة الاستباقية المقترحة" : lang === "ku" ? "هەنگاوی پێشهات" : "Proactive next step"}
        {intent.urgency === "high" && (
          <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] text-destructive">
            {lang === "ar" ? "إلحاح عالٍ" : lang === "ku" ? "پەلەی بەرز" : "high urgency"}
          </span>
        )}
      </div>
      <p className="mb-3 text-sm leading-relaxed text-foreground">{reason}</p>
      {target && (
        <button
          type="button"
          onClick={() => sendHandoff(target, handoffText || outputSummary || "")}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          {lang === "ar" ? "تشغيل" : lang === "ku" ? "جێبەجێ بکە" : "Run"} {targetLabel}
          <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}
