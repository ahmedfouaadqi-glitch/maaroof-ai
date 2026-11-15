/**
 * Evidence-first fact discovery primitives.
 *
 * This module deliberately does not call an LLM or write to the database.
 * It prevents generated conclusions from being promoted to facts unless
 * they carry traceable source evidence. Persistence is delegated to the
 * existing reality_records/evidence_items pipeline.
 */

export type FactKind = "observed_fact" | "computed_fact" | "inferred_finding" | "hypothesis";
export type FactStatus = "supported" | "needs_validation" | "rejected";

export type FactEvidence = {
  source_kind: string;
  source_ref: string;
  locator?: string | null;
  excerpt: string;
  collected_at: string;
  collection_method: string;
};

export type FactCandidate = {
  key: string;
  subject: string;
  predicate: string;
  value: string | number | boolean | null;
  kind: FactKind;
  evidence: FactEvidence[];
  /** Required for computed facts; describe the deterministic calculation. */
  formula?: string | null;
  /** Input fact keys used by a computed fact. */
  input_fact_keys?: string[];
  /** Inference rule or rationale; never presented as direct observation. */
  rationale?: string | null;
};

export type DiscoveredFact = FactCandidate & {
  status: FactStatus;
  validation_errors: string[];
  normalized_key: string;
};

export type Insight = {
  id: string;
  kind: "opportunity" | "risk" | "information_gap";
  title: string;
  explanation: string;
  fact_keys: string[];
  status: "evidence_linked" | "requires_validation";
};

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function validateFactCandidate(candidate: FactCandidate): string[] {
  const errors: string[] = [];
  if (!nonBlank(candidate.key)) errors.push("fact_key_missing");
  if (!nonBlank(candidate.subject)) errors.push("subject_missing");
  if (!nonBlank(candidate.predicate)) errors.push("predicate_missing");
  if (candidate.value === null || candidate.value === undefined || candidate.value === "") errors.push("value_missing");
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
    errors.push("evidence_required");
  } else {
    candidate.evidence.forEach((e, index) => {
      if (!nonBlank(e.source_kind)) errors.push(`evidence_${index}_source_kind_missing`);
      if (!nonBlank(e.source_ref)) errors.push(`evidence_${index}_source_ref_missing`);
      if (!nonBlank(e.excerpt)) errors.push(`evidence_${index}_excerpt_missing`);
      if (!nonBlank(e.collection_method)) errors.push(`evidence_${index}_method_missing`);
      if (!nonBlank(e.collected_at) || Number.isNaN(Date.parse(e.collected_at))) errors.push(`evidence_${index}_timestamp_invalid`);
    });
  }
  if (candidate.kind === "computed_fact") {
    if (!nonBlank(candidate.formula)) errors.push("computed_formula_required");
    if (!candidate.input_fact_keys?.length) errors.push("computed_inputs_required");
  }
  if (candidate.kind === "inferred_finding" || candidate.kind === "hypothesis") {
    if (!nonBlank(candidate.rationale)) errors.push("inference_rationale_required");
  }
  return errors;
}

/**
 * A valid candidate is not automatically a verified fact:
 * inferences/hypotheses remain in needs_validation until independently checked.
 */
export function discoverFact(candidate: FactCandidate): DiscoveredFact {
  const errors = validateFactCandidate(candidate);
  const status: FactStatus = errors.length
    ? "rejected"
    : candidate.kind === "observed_fact" || candidate.kind === "computed_fact"
      ? "supported"
      : "needs_validation";
  return {
    ...candidate,
    status,
    validation_errors: errors,
    normalized_key: [candidate.subject, candidate.predicate, String(candidate.value)]
      .map((part) => part.trim().toLocaleLowerCase())
      .join("::"),
  };
}

/** Build a traceable insight. It never invents a metric, impact estimate or priority score. */
export function createInsight(input: {
  id: string;
  kind: Insight["kind"];
  title: string;
  explanation: string;
  facts: DiscoveredFact[];
}): Insight | null {
  const linked = input.facts.filter((fact) =>
    fact.status !== "rejected" && fact.evidence.length > 0
  );
  if (!nonBlank(input.id) || !nonBlank(input.title) || !nonBlank(input.explanation) || linked.length === 0) return null;
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    explanation: input.explanation,
    fact_keys: linked.map((fact) => fact.key),
    status: linked.every((fact) => fact.status === "supported") ? "evidence_linked" : "requires_validation",
  };
}
