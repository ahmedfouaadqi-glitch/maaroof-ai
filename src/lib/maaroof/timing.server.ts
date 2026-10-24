// Part 7 — Strategic Time Engine.
// Decides WHEN a plan should run, not just what to run. Purely heuristic
// (zero extra LLM cost) and derived from signals the run already has:
// workspace budget/risk policies, plan shape, council objections, and
// estimated spend so far. Flag-gated by settings.executive.timing_enabled;
// when disabled the orchestrator never calls this module.

export type TimingVerdict = "execute_now" | "delay" | "schedule" | "observe" | "cancel";

export type TimingDecision = {
  verdict: TimingVerdict;
  reason: string;
  confidence: number; // 0..1
  suggested_at?: string | null; // ISO, only for "schedule"/"delay"
  factors: Record<string, unknown>;
};

export type TimingInput = {
  goal: string;
  steps: Array<{ tool: string; input?: any }>;
  councilObjections: number;
  councilAvgConfidence: number | null; // 0..100
  spentUsd: number;
  workspace?: {
    risk_level?: string | null;
    budget?: Record<string, any> | null;
    policies?: Record<string, any> | null;
  } | null;
};

/** Heuristic timing assessment. Defaults to execute_now so behaviour is
 *  unchanged unless a real blocking signal is present. */
export function assessTiming(input: TimingInput): TimingDecision {
  const factors: Record<string, unknown> = {};
  const risk = String(input.workspace?.risk_level || "medium").toLowerCase();
  const maxUsd = Number(input.workspace?.budget?.max_usd_per_run ?? NaN);
  const conf = input.councilAvgConfidence;
  const objections = input.councilObjections || 0;
  factors.risk_level = risk;
  factors.objections = objections;
  factors.council_confidence = conf;
  factors.spent_usd = Number(input.spentUsd.toFixed(6));
  if (Number.isFinite(maxUsd)) factors.budget_max_usd_per_run = maxUsd;

  // 1) Hard budget stop.
  if (Number.isFinite(maxUsd) && input.spentUsd >= maxUsd) {
    return {
      verdict: "cancel",
      reason: "تجاوزت الجلسة سقف الميزانية المحدد في مساحة العمل قبل التنفيذ.",
      confidence: 0.95,
      suggested_at: null,
      factors,
    };
  }

  // 2) Nothing to execute.
  if (!input.steps.length) {
    return {
      verdict: "observe",
      reason: "لا توجد خطوات قابلة للتنفيذ — الأفضل المراقبة وجمع بيانات أكثر.",
      confidence: 0.8,
      suggested_at: null,
      factors,
    };
  }

  // 3) Very low council confidence + objections on a high-risk workspace.
  if (conf != null && conf < 40 && objections > 0 && risk === "low") {
    return {
      verdict: "delay",
      reason: "ثقة المجلس منخفضة مع اعتراضات قائمة، ومساحة العمل محافظة — يُفضّل التأجيل حتى تتوفر أدلة أقوى.",
      confidence: 0.75,
      suggested_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      factors,
    };
  }

  // 4) Large plan on a conservative workspace → schedule instead of a long burst.
  if (input.steps.length >= 5 && risk === "low") {
    return {
      verdict: "schedule",
      reason: "الخطة طويلة والمخاطرة المسموحة منخفضة — جدولة التنفيذ أفضل من تشغيله دفعة واحدة.",
      confidence: 0.7,
      suggested_at: new Date(Date.now() + 3600_000).toISOString(),
      factors,
    };
  }

  // 5) Objections but decent confidence → run now, flagged.
  return {
    verdict: "execute_now",
    reason: objections > 0
      ? "توجد ملاحظات لكن الثقة كافية للتنفيذ الآن مع الانتباه للاعتراضات."
      : "الظروف مناسبة للتنفيذ الآن.",
    confidence: conf != null ? Math.max(0.5, Math.min(0.95, conf / 100)) : 0.7,
    suggested_at: null,
    factors,
  };
}
