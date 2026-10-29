import type { EngineAnswer } from "@/lib/operational-workbook";
import type { ClusterAnswer } from "@/lib/keyword-clusters";
import { ENGINE_COUNCIL_MODELS } from "@/lib/maaroof/tool-council";

export const LIVE_AXES = ["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"] as const;
export type LiveAxis = (typeof LIVE_AXES)[number];
export type AxisMeasurement = {
  value: number | null;
  reason: string | null;
  position?: number | null;
  evidenceUrl?: string | null;
  engines?: string[];
  provider?: string | null;
};
export type LiveSearchResult = { url: string; title: string };
export type LiveSearchEvidence = {
  keyword: string;
  market: string;
  query: string;
  status: "measured" | "unavailable";
  provider?: string;
  results: LiveSearchResult[];
  answerBoxChecked?: boolean;
  answerBoxCitations?: string[];
  aiOverviewChecked?: boolean;
  aiOverviewCitations?: string[];
  error?: string;
};
export type KeywordAxisMeasurements = Record<LiveAxis, AxisMeasurement>;

const normalize = (s: string) => String(s || "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
function host(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}
function domainMatches(url: string, site: string): boolean {
  const a = host(url);
  const b = host(site);
  return Boolean(a && b && (a === b || a.endsWith("." + b)));
}
function blank(reason: string, provider?: string): AxisMeasurement {
  return { value: null, reason, provider: provider || null };
}
function linkedAxis(
  evidence: LiveSearchEvidence | undefined,
  site: string,
  kind: "answerBox" | "aiOverview",
  liveSerpRequested: boolean,
): AxisMeasurement {
  if (!liveSerpRequested) return blank("live_search_not_requested");
  if (!evidence || evidence.status !== "measured") return blank(evidence?.error || "live_search_unavailable", evidence?.provider);
  const checked = kind === "answerBox"
    ? evidence.answerBoxChecked
    : evidence.aiOverviewChecked === true || evidence.answerBoxChecked === true;
  const citations = kind === "answerBox"
    ? evidence.answerBoxCitations
    : [...(evidence.aiOverviewCitations || []), ...(evidence.answerBoxCitations || [])];
  if (checked !== true) return blank(kind === "answerBox" ? "answer_box_not_exposed_by_provider" : "ai_overview_and_answer_box_not_exposed_by_provider", evidence.provider);
  if (!site) return blank("target_site_missing", evidence.provider);
  const evidenceUrl = (citations || []).find((url) => domainMatches(url, site)) || null;
  return { value: evidenceUrl ? 100 : 0, reason: null, evidenceUrl, provider: evidence.provider || null };
}

/**
 * Calculates only observable metrics. Missing, proxy, and incomplete observations
 * remain null with an explicit reason; they are never converted into heuristic scores.
 */
export function measureKeywordAxes(input: {
  keyword: string;
  market: string;
  brand: string;
  site?: string | null;
  engineAnswers: EngineAnswer[];
  clusterAnswers?: ClusterAnswer[];
  liveSearchEvidence?: LiveSearchEvidence[];
  liveSerpRequested: boolean;
}): KeywordAxisMeasurements {
  const keyword = normalize(input.keyword);
  const market = input.market;
  const brand = normalize(input.brand);
  const site = String(input.site || "").trim();
  const search = (input.liveSearchEvidence || []).find((item) => item.market === market && normalize(item.keyword) === keyword);
  let seo: AxisMeasurement;
  if (!input.liveSerpRequested) seo = blank("live_search_not_requested");
  else if (!search || search.status !== "measured") seo = blank(search?.error || "live_search_not_completed", search?.provider);
  else if (!site) seo = blank("target_site_missing", search.provider);
  else {
    const results = search.results.slice(0, 10);
    const index = results.findIndex((item) => domainMatches(item.url, site));
    if (index >= 0) {
      const position = index + 1;
      // The value is the observed rank itself — no derived score.
      seo = { value: position, reason: null, position, evidenceUrl: results[index].url, provider: search.provider || null };
    } else if (results.length >= 10) {
      // Observed fact: the site is absent from a complete top-ten result set.
      seo = { value: null, reason: "not_in_top_ten", position: null, evidenceUrl: null, provider: search.provider || null };
    } else {
      seo = blank("fewer_than_ten_results", search.provider);
    }
  }

  const keywordSpecific = input.engineAnswers.filter((answer) =>
    answer.market === market && answer.probe_kind === "keyword_visibility" &&
    normalize(answer.query || "").includes(keyword)
  );
  const clusterRelated = (input.clusterAnswers || []).filter((answer) =>
    answer.market === market && answer.keywords.some((k) => normalize(k) === keyword)
  );
  const modelRelated = input.engineAnswers.filter((answer) =>
    answer.market === market && normalize(answer.query || "").includes(keyword)
  );
  const selected = keywordSpecific.length ? keywordSpecific : clusterRelated.length ? clusterRelated : modelRelated;
  const expectedEngines = ENGINE_COUNCIL_MODELS.map((engine) => engine.key);
  const byEngine = new Map<string, { status: string; answer: string; provider_path?: string; urls?: string[] }>();
  for (const answer of selected) {
    const current = byEngine.get(answer.engine);
    if (!current || (current.status !== "answered" && answer.status === "answered")) {
      byEngine.set(answer.engine, answer);
    }
  }
  // Every successful answer counts, whichever route delivered it (direct or automatic backup).
  const answeredEngines = expectedEngines.filter((engine) => byEngine.get(engine)?.status === "answered");
  let geo: AxisMeasurement;
  if (!brand) geo = blank("brand_not_configured");
  else if (!selected.length) geo = blank("keyword_not_probed_by_ten_engines");
  else if (!answeredEngines.length) geo = blank("incomplete_ten_engine_evidence");
  else {
    const engines = answeredEngines.filter((engine) => normalize(byEngine.get(engine)?.answer || "").includes(brand));
    // Observed ratio: engines that mentioned the brand out of engines that answered.
    geo = { value: Math.round((engines.length / answeredEngines.length) * 100), reason: null, engines };
  }
  let sgeo: AxisMeasurement;
  if (!site) sgeo = blank("target_site_missing");
  else if (!answeredEngines.length) sgeo = blank("incomplete_ten_engine_evidence");
  else {
    const withUrls = answeredEngines.filter((engine) => Array.isArray(byEngine.get(engine)?.urls));
    if (!withUrls.length) sgeo = blank("engine_citations_not_recorded");
    else {
      const citing = withUrls.filter((engine) => (byEngine.get(engine)?.urls || []).some((u) => domainMatches(u, site)));
      const evidenceUrl = citing.length ? (byEngine.get(citing[0])?.urls || []).find((u) => domainMatches(u, site)) || null : null;
      sgeo = { value: Math.round((citing.length / withUrls.length) * 100), reason: null, engines: citing, evidenceUrl };
    }
  }
  // GSEO = real intersection: both SEO rank and GEO mention were observed for this keyword.
  let gseo: AxisMeasurement;
  if (geo.value === null || (seo.value === null && seo.reason !== "not_in_top_ten")) gseo = blank("gseo_requires_both_seo_and_geo_observations", search?.provider);
  else gseo = { value: seo.position && (geo.engines?.length || 0) > 0 ? 100 : 0, reason: null, position: seo.position ?? null, evidenceUrl: seo.evidenceUrl ?? null, engines: geo.engines };

  const aeo = linkedAxis(search, site, "answerBox", input.liveSerpRequested);
  const sge = linkedAxis(search, site, "aiOverview", input.liveSerpRequested);
  return {
    SEO: seo,
    AEO: aeo,
    GEO: geo,
    SGE: sge,
    GSEO: gseo,
    SGEO: sgeo,
  };
}

export function unmeasuredReasonSummary(
  axes: KeywordAxisMeasurements,
  translate: (axis: LiveAxis, reason: string) => string,
): string {
  return LIVE_AXES
    .filter((axis) => axes[axis].value === null)
    .map((axis) => `${axis}: ${translate(axis, axes[axis].reason || "measurement_unavailable")}`)
    .join("; ");
}
