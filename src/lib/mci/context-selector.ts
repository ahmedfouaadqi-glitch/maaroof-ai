// Minimal Sufficient Context selector: ranks items and fits them to the budget.
import type { CognitiveStage, ContextItem, KnowledgeClaimType } from "./types";
import { estimateTokens } from "./context-budget";
import { ProvenanceLog } from "./context-provenance";

const CLAIM_WEIGHT: Record<KnowledgeClaimType, number> = {
  verified_fact: 1, fact: 0.85, contested: 0.7, inference: 0.6, recommendation: 0.5,
  hypothesis: 0.4, temporary_observation: 0.35, opinion: 0.2,
};

type ValidItem = { item: ContextItem; tokens: number; reliability: number };

export function selectContext(items: ContextItem[], stage: CognitiveStage, budget: number, log = new ProvenanceLog()) {
  const valid: ValidItem[] = [];
  for (const item of items) {
    const reliability = item.reliability === undefined ? 0 : item.reliability;
    if (typeof reliability !== "number" || !Number.isFinite(reliability) || reliability < 0 || reliability > 1) {
      log.record(item, stage, false, "invalid_reliability");
      continue;
    }
    const tokens = item.tokens === undefined ? estimateTokens(item.content) : item.tokens;
    if (typeof tokens !== "number" || !Number.isSafeInteger(tokens) || tokens < 0) {
      log.record(item, stage, false, "invalid_token_count");
      continue;
    }
    valid.push({ item, tokens, reliability });
  }

  const ranked = valid.sort((a, b) =>
    (CLAIM_WEIGHT[b.item.claimType] + b.reliability) - (CLAIM_WEIGHT[a.item.claimType] + a.reliability));
  const safeBudget = Number.isFinite(budget) ? Math.max(0, Math.floor(budget)) : 0;
  const selected: ContextItem[] = [];
  let used = 0;
  for (const entry of ranked) {
    if (used + entry.tokens <= safeBudget) {
      selected.push(entry.item);
      used += entry.tokens;
      log.record(entry.item, stage, true, "fits_budget");
    } else log.record(entry.item, stage, false, "over_budget");
  }
  return { selected, usedTokens: used, budget: safeBudget, provenance: log };
}
