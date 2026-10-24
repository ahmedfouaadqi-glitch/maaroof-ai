// Evidence gate + failure strategy. MCI never decides truth: it only reads the
// verification layer's labels to decide whether a fresh web fetch is needed.
import type { CognitiveStage, ContextItem, FailureStrategy, RiskLevel } from "./types";

export type WebDecision = { needWeb: boolean; reason: string };

export function evidenceGate(items: ContextItem[], threshold = 0.85): WebDecision {
  if (items.some((i) => i.claimType === "contested")) return { needWeb: true, reason: "contested_claim" };
  const strong = items.some((i) => i.claimType === "verified_fact" && (i.reliability ?? 0) >= threshold);
  return strong ? { needWeb: false, reason: "verified_evidence_present" } : { needWeb: true, reason: "no_verified_evidence" };
}

const SAFE_STAGES: CognitiveStage[] = ["reality", "verification"];

export function resolveFailureStrategy(stage: CognitiveStage, risk: RiskLevel = "low"): FailureStrategy {
  if (SAFE_STAGES.includes(stage) || risk === "high") return "fail_safe_block";
  return "fail_open_with_fallback";
}
