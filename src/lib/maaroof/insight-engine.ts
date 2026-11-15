import type { DiscoveredFact, Insight } from "./fact-discovery";

export type InsightRule = {
  id: string;
  kind: Insight["kind"];
  title: string;
  explanation: string;
  requiredPredicates: string[];
  /** A rule may require a fact value; matching is strict and case-insensitive for strings. */
  expectedValues?: Record<string, string | number | boolean>;
};

export type InsightResult = Insight & {
  rule_id: string;
  validation_notes: string[];
};

function sameValue(actual: unknown, expected: unknown): boolean {
  return typeof actual === "string" && typeof expected === "string"
    ? actual.trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase()
    : actual === expected;
}

/** Deterministic, explainable rule evaluation. No LLM and no invented business metrics. */
export function evaluateInsightRules(facts: DiscoveredFact[], rules: InsightRule[]): InsightResult[] {
  const accepted = facts.filter((f) => f.status !== "rejected" && f.evidence.length > 0);
  const results: InsightResult[] = [];
  for (const rule of rules) {
    const linked = accepted.filter((fact) => rule.requiredPredicates.includes(fact.predicate));
    const byPredicate = new Map(linked.map((fact) => [fact.predicate, fact]));
    const allPresent = rule.requiredPredicates.every((predicate) => byPredicate.has(predicate));
    const expectedMatch = Object.entries(rule.expectedValues || {}).every(([predicate, expected]) => {
      const fact = byPredicate.get(predicate);
      return Boolean(fact && sameValue(fact.value, expected));
    });
    if (!allPresent || !expectedMatch) continue;
    const status = linked.every((f) => f.status === "supported") ? "evidence_linked" : "requires_validation";
    results.push({
      id: rule.id,
      rule_id: rule.id,
      kind: rule.kind,
      title: rule.title,
      explanation: rule.explanation,
      fact_keys: linked.map((f) => f.key),
      status,
      validation_notes: linked.filter((f) => f.status !== "supported").map((f) => `Fact ${f.key} needs independent validation.`),
    });
  }
  return results;
}
