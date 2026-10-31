/**
 * Metrics for the six-question visibility pack.
 * Samples are query-level; the blind-discovery answer and five branded scenarios stay separate.
 * The grounded phase is co-batched for cost control, so these are scenario observations, not six independent model sessions.
 */
export type QueryPackKind =
  | "blind_discovery"
  | "brand_recognition"
  | "recommendation"
  | "comparison"
  | "fact_verification"
  | "purchase_intent";

export type QueryPackObservation = {
  kind: QueryPackKind | string;
  answer?: string;
  brands?: string[];
  urls?: string[];
};

export type EnginePackAnswer = {
  engine: string;
  answer?: string;
  brands?: string[];
  rank?: number | null;
  blind_status?: string;
  grounded_status?: string;
  query_observations?: QueryPackObservation[];
};

export type PackEngineStatus = {
  status?: string;
  blind_status?: string;
  grounded_status?: string;
};

type Rate = { numerator: number; denominator: number; value_pct: number | null };
const rate = (n: number, d: number): Rate => ({
  numerator: n,
  denominator: d,
  value_pct: d > 0 ? Number(((n / d) * 100).toFixed(2)) : null,
});

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim()
  .replace(/\s+/g, " ");

function hasBrand(value: unknown, brand: string): boolean {
  const text = normalize(value);
  const name = normalize(brand);
  return !!text && !!name && (" " + text + " ").includes(" " + name + " ");
}

export function calculateVisibilityQueryPackMetrics(
  brandName: string,
  requestedEngines: string[],
  kinds: QueryPackKind[],
  inputAnswers: EnginePackAnswer[],
  statuses: Record<string, PackEngineStatus> = {},
) {
  const engines = [...new Set(requestedEngines.map((x) => String(x || "").trim()).filter(Boolean))];
  const answers = new Map(inputAnswers.map((answer) => [answer.engine, answer]));
  const observations: Array<{ engine: string; kind: QueryPackKind; status: "answered" | "failed" | "not_run"; answer: string; brands: string[]; urls: string[] }> = [];

  for (const engine of engines) {
    const answer = answers.get(engine);
    const state = statuses[engine] || {};
    for (const kind of kinds) {
      if (kind === "blind_discovery") {
        const text = String(answer?.answer || "").trim();
        const status = answer?.blind_status === "answered" && text ? "answered" : state.blind_status && state.blind_status !== "answered" ? "failed" : "not_run";
        observations.push({ engine, kind, status, answer: status === "answered" ? text : "", brands: status === "answered" ? (answer?.brands || []) : [], urls: [] });
        continue;
      }
      const queryObservation = (answer?.query_observations || []).find((item) => item.kind === kind);
      const text = String(queryObservation?.answer || "").trim();
      const status = text ? "answered" : state.grounded_status && state.grounded_status !== "answered" && state.grounded_status !== "ok" ? "failed" : "not_run";
      observations.push({
        engine, kind, status,
        answer: status === "answered" ? text : "",
        brands: status === "answered" && Array.isArray(queryObservation?.brands) ? queryObservation!.brands! : [],
        urls: status === "answered" && Array.isArray(queryObservation?.urls) ? queryObservation!.urls! : [],
      });
    }
  }

  const answered = observations.filter((item) => item.status === "answered");
  const failed = observations.filter((item) => item.status === "failed");
  const mentioned = answered.filter((item) =>
    hasBrand(item.answer, brandName) || item.brands.some((brand) => hasBrand(brand, brandName)),
  );
  const listRows = answered.filter((item) => item.brands.length > 0);
  const allListedBrands = listRows.flatMap((item) => [...new Set(item.brands.map(normalize).filter(Boolean))]);
  const targetListMentions = allListedBrands.filter((brand) => brand === normalize(brandName)).length;
  const rankedTarget = listRows.filter((item) => item.brands.some((brand) => hasBrand(brand, brandName)));
  const topFive = rankedTarget.filter((item) => {
    const index = item.brands.findIndex((brand) => hasBrand(brand, brandName));
    return index >= 0 && index < 5;
  }).length;
  const recommendationRows = answered.filter((item) => item.kind === "recommendation");
  const recommended = recommendationRows.filter((item) => item.brands.some((brand) => hasBrand(brand, brandName))).length;

  const byQuery = kinds.map((kind) => {
    const rows = observations.filter((item) => item.kind === kind);
    const done = rows.filter((item) => item.status === "answered");
    const mentionedCount = done.filter((item) => hasBrand(item.answer, brandName) || item.brands.some((brand) => hasBrand(brand, brandName))).length;
    const recommendationDenominator = kind === "recommendation" ? done.length : 0;
    const recommendationNumerator = kind === "recommendation"
      ? done.filter((item) => item.brands.some((brand) => hasBrand(brand, brandName))).length : 0;
    return {
      kind, planned: rows.length, answered: done.length,
      failed: rows.filter((item) => item.status === "failed").length,
      mention_rate: rate(mentionedCount, done.length),
      recommendation_rate: kind === "recommendation" ? rate(recommendationNumerator, recommendationDenominator) : null,
    };
  });

  const planned = observations.length;
  return {
    basis: "observed_query_pack_answers" as const,
    mode: "one_blind_query_plus_five_batched_branded_scenarios" as const,
    brand: brandName,
    planned,
    answered: answered.length,
    failed: failed.length,
    unmeasured: Math.max(0, planned - answered.length - failed.length),
    coverage: rate(answered.length, planned),
    mention_rate: rate(mentioned.length, answered.length),
    recommendation_rate: rate(recommended, recommendationRows.length),
    top_five_rate: rate(topFive, listRows.length),
    share_of_voice: rate(targetListMentions, allListedBrands.length),
    by_query: byQuery,
    limitations: [
      "The blind-discovery prompt omits the target brand; the other five scenarios are co-batched in the evidence-grounded phase to avoid multiplying model calls.",
      "Query-level outputs are observations from one model request per phase, not six independent sessions.",
      "Only successful, non-empty query observations enter visibility denominators; missing/failed observations remain separate.",
      "Share of voice is calculated only from returned brand lists in this query sample, not market share or platform-wide share.",
    ],
  };
}
