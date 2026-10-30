/**
 * Evidence-aware metrics for MAAROOF's blind AI-visibility probe.
 *
 * Pure module: no network, database, or provider calls.
 * Metrics describe the observed probe sample only; they do not estimate market share.
 */

export type VisibilityMetricAnswer = {
  engine: string;
  answer?: string;
  mentioned?: boolean;
  rank?: number | null;
  brands?: string[];
  cited_urls?: string[];
  sources?: Array<{ url?: string; title?: string }>;
  status?: string;
};

export type VisibilityMetricValue = {
  value_pct: number | null;
  numerator: number;
  denominator: number;
};

export type VisibilityProbeMetrics = {
  version: "1.0";
  basis: "observed_blind_probe_answers";
  brand: string;
  requested_engines: number;
  answered_engines: number;
  engine_coverage: VisibilityMetricValue;
  mentioned_engines: number;
  mention_coverage: VisibilityMetricValue;
  mentioned_answers: number;
  mention_rate: VisibilityMetricValue;
  recommended_answers: number;
  recommendation_rate: VisibilityMetricValue;
  share_of_voice: VisibilityMetricValue;
  citation_rate: VisibilityMetricValue;
  citation_rate_definition: string;
  ranked_answers: number;
  top5_answers: number;
  top5_rate: VisibilityMetricValue;
  average_rank: number | null;
  limitations: string[];
};

function normalizeLabel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsLabel(text: unknown, label: unknown): boolean {
  const haystack = normalizeLabel(text);
  const needle = normalizeLabel(label);
  if (!haystack || !needle) return false;
  return (` ${haystack} `).includes(` ${needle} `);
}

function rate(numerator: number, denominator: number): VisibilityMetricValue {
  return {
    value_pct: denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : null,
    numerator,
    denominator,
  };
}

function uniqueLabels(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const label = String(value ?? "").trim();
    const key = normalizeLabel(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/**
 * Calculates metrics from successful, non-empty answers only.
 * An engine failure is tracked in engine_coverage and never treated as a no-mention.
 */
export function calculateVisibilityProbeMetrics(
  brandName: string,
  requestedEngines: string[],
  inputAnswers: VisibilityMetricAnswer[],
): VisibilityProbeMetrics {
  const brand = String(brandName ?? "").trim();
  const normalizedBrand = normalizeLabel(brand);
  const requested = uniqueLabels(requestedEngines);
  const byEngine = new Map<string, VisibilityMetricAnswer>();

  for (const answer of inputAnswers) {
    const engineKey = normalizeLabel(answer?.engine);
    if (!engineKey || !String(answer?.answer ?? "").trim()) continue;
    // Keep one observation per engine so accidental duplicate rows do not inflate metrics.
    if (!byEngine.has(engineKey)) byEngine.set(engineKey, answer);
  }

  const answers = [...byEngine.values()];
  const mentionAnswer = (answer: VisibilityMetricAnswer) =>
    answer.mentioned === true || containsLabel(answer.answer, brand);
  const mentionedAnswers = answers.filter(mentionAnswer);
  const mentionedEngines = mentionedAnswers.length;

  const recommendedAnswers = answers.filter((answer) =>
    (Array.isArray(answer.brands) ? answer.brands : []).some((candidate) => containsLabel(candidate, brand)),
  );

  let totalBrandListMentions = 0;
  let targetBrandListMentions = 0;
  for (const answer of answers) {
    const brands = uniqueLabels(Array.isArray(answer.brands) ? answer.brands : []);
    totalBrandListMentions += brands.length;
    targetBrandListMentions += brands.filter((candidate) => containsLabel(candidate, brand)).length;
  }

  const citationAnswers = answers.filter((answer) => {
    const sources = new Set(
      (Array.isArray(answer.sources) ? answer.sources : [])
        .map((source) => String(source?.url ?? "").trim())
        .filter((url) => /^https?:\/\//i.test(url)),
    );
    return (Array.isArray(answer.cited_urls) ? answer.cited_urls : [])
      .some((url) => sources.has(String(url ?? "").trim()));
  }).length;

  const rankedAnswers = answers.filter((answer) =>
    (Array.isArray(answer.brands) ? uniqueLabels(answer.brands) : []).length > 0,
  );
  const ranked = answers
    .filter((answer) =>
      Number.isFinite(Number(answer.rank)) &&
      Number(answer.rank) > 0 &&
      (Array.isArray(answer.brands) ? answer.brands.some((candidate) => containsLabel(candidate, brand)) : false),
    )
    .map((answer) => Number(answer.rank));
  const top5Answers = answers.filter((answer) => {
    const rank = Number(answer.rank);
    return Number.isFinite(rank) && rank >= 1 && rank <= 5 &&
      (Array.isArray(answer.brands) ? answer.brands.some((candidate) => containsLabel(candidate, brand)) : false);
  }).length;

  const validBrand = Boolean(normalizedBrand);
  const denominator = answers.length;
  return {
    version: "1.0",
    basis: "observed_blind_probe_answers",
    brand,
    requested_engines: requested.length,
    answered_engines: answers.length,
    engine_coverage: rate(answers.length, requested.length),
    mentioned_engines: mentionedEngines,
    mention_coverage: rate(mentionedEngines, answers.length),
    mentioned_answers: mentionedAnswers.length,
    mention_rate: rate(mentionedAnswers.length, denominator),
    recommended_answers: recommendedAnswers.length,
    recommendation_rate: rate(recommendedAnswers.length, denominator),
    share_of_voice: rate(targetBrandListMentions, totalBrandListMentions),
    citation_rate: rate(citationAnswers, denominator),
    citation_rate_definition: "Percentage of successful probe answers whose model-returned URL exactly matches a collected evidence URL. This is not native citation telemetry from the consumer product UI.",
    ranked_answers: rankedAnswers.length,
    top5_answers: top5Answers,
    top5_rate: rate(top5Answers, rankedAnswers.length),
    average_rank: ranked.length ? Number((ranked.reduce((sum, rank) => sum + rank, 0) / ranked.length).toFixed(2)) : null,
    limitations: [
      "Metrics describe only the successful answers in this run and the requested engine set.",
      "The configured API/model route may not be equivalent to the consumer-facing product bearing the same engine name.",
      "Share of voice uses unique brand labels in model-returned ranked brand lists; it is not market share.",
      "With one answer per engine, mention coverage and mention rate coincide; they diverge when multiple answers per engine are sampled.",
      "Citation rate counts model-returned URLs that exactly match collected evidence URLs; it does not prove a native UI citation.",
      ...(!validBrand ? ["The target brand name was empty; brand-specific metrics may be uninformative."] : []),
    ],
  };
}
