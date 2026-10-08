// Minimal Sufficient Context selector: ranks items and fits them to the budget.
import type { CognitiveStage, ContextItem, KnowledgeClaimType } from "./types";
import { estimateTokens } from "./context-budget";
import { ProvenanceLog } from "./context-provenance";

const CLAIM_WEIGHT: Record<KnowledgeClaimType, number> = {
  verified_fact: 1, fact: 0.85, contested: 0.7, inference: 0.6, recommendation: 0.5,
  hypothesis: 0.4, temporary_observation: 0.35, opinion: 0.2,
};

export function selectContext(items: ContextItem[], stage: CognitiveStage, budget: number, log = new ProvenanceLog()) {
  const ranked = [...items].sort((a, b) =>
    (CLAIM_WEIGHT[b.claimType] + (b.reliability ?? 0)) - (CLAIM_WEIGHT[a.claimType] + (a.reliability ?? 0)));
  const selected: ContextItem[] = [];
  let used = 0;
  for (const it of ranked) {
    const t = it.tokens ?? estimateTokens(it.content);
    if (used + t <= budget) { selected.push(it); used += t; log.record(it, stage, true, "fits_budget"); }
    else log.record(it, stage, false, "over_budget");
  }
  return { selected, usedTokens: used, budget, provenance: log };
}
