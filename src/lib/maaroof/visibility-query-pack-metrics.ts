/**
 * Query-level metrics for the six-scenario visibility probe.
 * Only the unbranded discovery question is used for organic brand mention / share-of-voice.
 * Branded prompts explicitly prime the target name and therefore cannot be treated as organic mentions.
 */
export type QueryPackKind =
  | "blind_discovery"
  | "brand_recognition"
  | "recommendation"
  | "comparison"
  | "fact_verification"
  | "purchase_intent";

export type QueryPackOutcome =
  | "recognized" | "not_recognized" | "ambiguous"
  | "recommended" | "not_recommended" | "conditional"
  | "comparison_available" | "comparison_not_available"
  | "good_fit" | "limited_fit" | "not_available" | "unknown";

export type QueryPackObservation = {
  kind: QueryPackKind | string;
  answer?: string;
  brands?: string[];
  urls?: string[];
  outcome?: QueryPackOutcome | string;
  evidence_level?: "verified" | "partially_verified" | "unverified" | "contradictory" | "unknown" | string;
  ranked?: boolean;
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

function acceptedOutcome(value: unknown): QueryPackOutcome | null {
  const allowed: QueryPackOutcome[] = [
    "recognized", "not_recognized", "ambiguous",
    "recommended", "not_recommended", "conditional",
    "comparison_available", "comparison_not_available",
    "good_fit", "limited_fit", "not_available", "unknown",
  ];
  const normalized = String(value ?? "").trim() as QueryPackOutcome;
  return allowed.includes(normalized) ? normalized : null;
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
  const observations: Array<{
    engine: string; kind: QueryPackKind; status: "answered" | "failed" | "not_run";
    answer: string; brands: string[]; urls: string[]; outcome: QueryPackOutcome | null;
    evidenceLevel: string | null; ranked: boolean;
  }> = [];

  for (const engine of engines) {
    const answer = answers.get(engine);
    const state = statuses[engine] || {};
    for (const kind of kinds) {
      if (kind === "blind_discovery") {
        const text = String(answer?.answer || "").trim();
        const status = answer?.blind_status === "answered" && text
          ? "answered"
          : state.blind_status && state.blind_status !== "answered" ? "failed" : "not_run";
        observations.push({
          engine, kind, status, answer: status === "answered" ? text : "",
          brands: status === "answered" ? (answer?.brands || []) : [],
          urls: [], outcome: null, evidenceLevel: null, ranked: status === "answered",
        });
        continue;
      }
      const queryObservation = (answer?.query_observations || []).find((item) => item.kind === kind);
      const text = String(queryObservation?.answer || "").trim();
      const status = text
        ? "answered"
        : state.grounded_status && state.grounded_status !== "answered" && state.grounded_status !== "ok"
          ? "failed" : "not_run";
      observations.push({
        engine, kind, status, answer: status === "answered" ? text : "",
        brands: status === "answered" && Array.isArray(queryObservation?.brands) ? queryObservation.brands : [],
        urls: status === "answered" && Array.isArray(queryObservation?.urls) ? queryObservation.urls : [],
        outcome: status === "answered" ? acceptedOutcome(queryObservation?.outcome) : null,
        evidenceLevel: status === "answered" ? String(queryObservation?.evidence_level || "") || null : null,
        ranked: status === "answered" && queryObservation?.ranked === true,
      });
    }
  }

  const answered = observations.filter((item) => item.status === "answered");
  const failed = observations.filter((item) => item.status === "failed");
  const blindAnswers = answered.filter((item) => item.kind === "blind_discovery");
  const organicMentions = blindAnswers.filter((item) =>
    hasBrand(item.answer, brandName) || item.brands.some((brand) => hasBrand(brand, brandName)),
  );
  const rankedBlindAnswers = blindAnswers.filter((item) => item.ranked && item.brands.length > 0);
  const topFive = rankedBlindAnswers.filter((item) => {
    const index = item.brands.findIndex((brand) => hasBrand(brand, brandName));
    return index >= 0 && index < 5;
  }).length;
  const blindBrandList = blindAnswers.flatMap((item) => [...new Set(item.brands.map(normalize).filter(Boolean))]);
  const targetBlindListMentions = blindBrandList.filter((brand) => brand === normalize(brandName)).length;

  const recommendationRows = observations.filter((item) => item.kind === "recommendation" && item.status === "answered");
  const recommendationWithVerdict = recommendationRows.filter((item) =>
    item.outcome === "recommended" || item.outcome === "not_recommended" || item.outcome === "conditional",
  );
  const recommended = recommendationWithVerdict.filter((item) => item.outcome === "recommended").length;

  const byQuery = kinds.map((kind) => {
    const rows = observations.filter((item) => item.kind === kind);
    const done = rows.filter((item) => item.status === "answered");
    const mentionCount = kind === "blind_discovery"
      ? done.filter((item) => hasBrand(item.answer, brandName) || item.brands.some((brand) => hasBrand(brand, brandName))).length
      : 0;
    const recommendationDone = kind === "recommendation"
      ? done.filter((item) => item.outcome === "recommended" || item.outcome === "not_recommended" || item.outcome === "conditional")
      : [];
    const verifiedRows = kind === "fact_verification"
      ? done.filter((item) => item.evidenceLevel === "verified" || item.evidenceLevel === "partially_verified" || item.evidenceLevel === "unverified" || item.evidenceLevel === "contradictory")
      : [];
    const outcomes = [...new Set(done.map((item) => item.outcome).filter(Boolean))];
    const evidenceLevels = [...new Set(done.map((item) => item.evidenceLevel).filter(Boolean))];
    return {
      kind,
      planned: rows.length,
      answered: done.length,
      failed: rows.filter((item) => item.status === "failed").length,
      organic_mention_rate: kind === "blind_discovery" ? rate(mentionCount, done.length) : null,
      recommendation_rate: kind === "recommendation"
        ? rate(recommendationDone.filter((item) => item.outcome === "recommended").length, recommendationDone.length) : null,
      verified_evidence_rate: kind === "fact_verification"
        ? rate(verifiedRows.filter((item) => item.evidenceLevel === "verified").length, verifiedRows.length) : null,
      outcomes,
      evidence_levels: evidenceLevels,
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
    organic_mention_rate: rate(organicMentions.length, blindAnswers.length),
    recommendation_rate: rate(recommended, recommendationWithVerdict.length),
    top_five_rate: rate(topFive, rankedBlindAnswers.length),
    share_of_voice: rate(targetBlindListMentions, blindBrandList.length),
    by_query: byQuery,
    metric_definitions: {
      organic_mention_rate: "Measured only against blind-discovery responses; branded scenarios are excluded because their prompts name the target brand.",
      recommendation_rate: "Model-stated recommended / not_recommended / conditional verdicts from the recommendation scenario only.",
      verified_evidence_rate: "Responses explicitly classified as verified divided by fact-verification responses with a recognized evidence-level label.",
      top_five_rate: "Target brand position 1–5 in ranked blind-discovery brand lists only.",
      share_of_voice: "Target brand occurrences / all returned brand-list occurrences in blind-discovery answers only; not market share.",
    },
    limitations: [
      "The blind-discovery prompt omits the target brand; the other five scenarios are co-batched in the evidence-grounded phase to avoid multiplying model calls.",
      "The five branded scenarios share one model request per engine and are not independent sessions.",
      "Brand mention rate and share of voice are calculated only from blind-discovery answers; branded scenarios are excluded to avoid brand-priming bias.",
      "Only successful non-empty observations enter metric denominators. Missing or failed observations remain separate.",
    ],
  };
}
