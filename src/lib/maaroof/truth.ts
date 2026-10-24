// Unified truth labelling — one vocabulary for every engine, tool and agent.
//
// The project already had two independent vocabularies: reality states
// (reality.server.ts) and verification verdicts (verification.server.ts).
// This module does NOT replace them; it is the single pure mapping layer that
// projects both onto the production labels shown to founders and stored on
// execution tasks / evidence items. Pure + browser-safe so the UI and tests
// can import it without pulling in server code.

export const VERIFICATION_STATES = [
  "VERIFIED",
  "MEASURED",
  "EXECUTED",
  "SIMULATED",
  "PREDICTED",
  "ASSUMED",
  "FAILED",
  "PENDING",
  "UNKNOWN",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

/** Ordering used by gates: "at least EXECUTED", "weaker than MEASURED", … */
export const STATE_RANK: Record<VerificationState, number> = {
  VERIFIED: 100,
  MEASURED: 85,
  EXECUTED: 70,
  SIMULATED: 40,
  PREDICTED: 30,
  ASSUMED: 20,
  PENDING: 10,
  FAILED: 5,
  UNKNOWN: 0,
};

export const STATE_LABELS: Record<VerificationState, { ar: string; en: string; ku: string }> = {
  VERIFIED: { ar: "مُتحقَّق", en: "Verified", ku: "پشتڕاستکراو" },
  MEASURED: { ar: "مقاس", en: "Measured", ku: "پێواوکراو" },
  EXECUTED: { ar: "منفَّذ", en: "Executed", ku: "جێبەجێکراو" },
  SIMULATED: { ar: "محاكاة", en: "Simulated", ku: "شێوەکاری" },
  PREDICTED: { ar: "متوقَّع", en: "Predicted", ku: "پێشبینیکراو" },
  ASSUMED: { ar: "مفترَض", en: "Assumed", ku: "گریمانەکراو" },
  FAILED: { ar: "فشل", en: "Failed", ku: "سەرکەوتوو نەبوو" },
  PENDING: { ar: "قيد التنفيذ", en: "Pending", ku: "چاوەڕوان" },
  UNKNOWN: { ar: "غير معروف", en: "Unknown", ku: "نەزانراو" },
};

export function stateLabel(state: string | null | undefined, language = "ar"): string {
  const s = (state || "UNKNOWN").toUpperCase() as VerificationState;
  const row = STATE_LABELS[s] ?? STATE_LABELS.UNKNOWN;
  return language === "en" ? row.en : language === "ku" ? row.ku : row.ar;
}

/** Reality states (reality.server.ts) → production labels. */
const FROM_REALITY: Record<string, VerificationState> = {
  verified: "VERIFIED",
  measured: "MEASURED",
  observed: "EXECUTED",
  historical: "MEASURED",
  external: "EXECUTED",
  internal: "EXECUTED",
  predicted: "PREDICTED",
  simulation: "SIMULATED",
  experimental: "SIMULATED",
  hypothesis: "ASSUMED",
  opinion: "ASSUMED",
  unknown: "UNKNOWN",
};

export function fromRealityState(state: string | null | undefined): VerificationState {
  return FROM_REALITY[String(state || "").toLowerCase()] ?? "UNKNOWN";
}

/** Verification verdicts (verification.server.ts) → production labels. */
export function fromVerdict(
  verdict: string | null | undefined,
  opts: { independentSources?: number; contradictions?: number } = {},
): VerificationState {
  const v = String(verdict || "").toLowerCase();
  if (v === "contested") return "ASSUMED";
  if (v === "verified" && (opts.independentSources ?? 0) >= 2 && !(opts.contradictions ?? 0)) return "VERIFIED";
  if (v === "verified") return "MEASURED";
  if (v === "supported") return "MEASURED";
  if (v === "unverified") return "ASSUMED";
  return "UNKNOWN";
}

/** execution_tasks.status → production label (honest by default: no runner ⇒ SIMULATED). */
export function fromTaskStatus(status: string | null | undefined, measured?: unknown): VerificationState {
  switch (String(status || "").toLowerCase()) {
    case "done":
    case "succeeded":
      return measured && Object.keys(measured as object).length ? "MEASURED" : "EXECUTED";
    case "failed":
      return "FAILED";
    case "simulated":
      return "SIMULATED";
    case "running":
    case "queued":
    case "pending":
      return "PENDING";
    default:
      return "UNKNOWN";
  }
}

export type TaskRollupInput = { status?: string | null; verification_state?: string | null };
export type RollupVerdict = "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED" | "PENDING" | "SIMULATED";

/** Sub-agent / execution rollup — never reports success it cannot account for. */
export function rollupTasks(tasks: TaskRollupInput[]): { verdict: RollupVerdict; state: VerificationState; done: number; failed: number; total: number } {
  const total = tasks.length;
  const states = tasks.map((t) => (t.verification_state as VerificationState) || fromTaskStatus(t.status));
  const done = states.filter((s) => s === "EXECUTED" || s === "MEASURED" || s === "VERIFIED").length;
  const failed = states.filter((s) => s === "FAILED").length;
  const pending = states.filter((s) => s === "PENDING").length;
  const simulated = states.filter((s) => s === "SIMULATED").length;

  let verdict: RollupVerdict;
  if (!total) verdict = "PENDING";
  else if (pending) verdict = "PENDING";
  else if (simulated === total) verdict = "SIMULATED";
  else if (done === total) verdict = "COMPLETED";
  else if (done === 0) verdict = "FAILED";
  else verdict = "PARTIALLY_COMPLETED";

  const weakest = states.length
    ? states.reduce((a, b) => (STATE_RANK[a] <= STATE_RANK[b] ? a : b))
    : ("PENDING" as VerificationState);
  return { verdict, state: weakest, done, failed, total };
}

export type GateInput = {
  state: VerificationState;
  evidenceCount?: number;
  independentSources?: number;
  contradictions?: number;
  /** Minimum label required before a claim may be presented as fact. */
  require?: VerificationState;
};

/** Publication gate: may this result be claimed as fact, and if not, why. */
export function verificationGate(input: GateInput): { pass: boolean; state: VerificationState; reasons: string[] } {
  const require = input.require ?? "EXECUTED";
  const reasons: string[] = [];
  if (STATE_RANK[input.state] < STATE_RANK[require]) {
    reasons.push(`الحالة ${input.state} أضعف من الحد المطلوب ${require}`);
  }
  if ((input.evidenceCount ?? 0) <= 0) reasons.push("لا توجد أدلة مسجّلة");
  if ((input.independentSources ?? 0) < 2) reasons.push("مصدر واحد فقط — لا تحقق متقاطع");
  if ((input.contradictions ?? 0) > 0) reasons.push(`تعارضات: ${input.contradictions}`);
  return { pass: reasons.length === 0, state: input.state, reasons };
}
