/**
 * Evidence-first primitives for unified AI/social visibility.
 * Pure functions only: callers must supply recorded observations from real runs.
 * Failed or missing observations never become zero-visibility results.
 */
export type VisibilityScope = {
  brandName: string;
  officialWebsite: string;
  geography: string;
  audienceLanguage: string;
  reportLanguage?: string;
};
export type ObservationStatus = "answered" | "cached" | "empty" | "timeout" | "error" | "not_run";
export type VisibilityObservation = {
  engine: string;
  queryId: string;
  status: ObservationStatus;
  answer: string | null;
  recommended: boolean | null;
  rankPosition: number | null;
  brands: string[];
  observedAt: string;
  provider?: string | null;
  model?: string | null;
};
export type MetricValue = { numerator: number; denominator: number; value: number | null };
export type VisibilityMetrics = {
  planned: number; completed: number; failed: number; unmeasured: number;
  coverage: MetricValue; mentionRate: MetricValue; recommendationRate: MetricValue;
  topFiveRate: MetricValue; shareOfVoice: MetricValue;
};

export function normalizeVisibilityScope(input: VisibilityScope): VisibilityScope {
  const brandName = String(input.brandName ?? "").trim().replace(/\s+/g, " ");
  const officialWebsite = String(input.officialWebsite ?? "").trim();
  const geography = String(input.geography ?? "").trim().replace(/\s+/g, " ");
  const audienceLanguage = String(input.audienceLanguage ?? "").trim().toLowerCase();
  const reportLanguage = String(input.reportLanguage ?? audienceLanguage).trim().toLowerCase();
  if (!brandName) throw new Error("Brand name is required.");
  if (!officialWebsite) throw new Error("Official website URL is required.");
  let parsed: URL;
  try { parsed = new URL(officialWebsite); } catch { throw new Error("Official website must be a valid absolute URL."); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Official website URL must use HTTP or HTTPS.");
  if (!geography) throw new Error("Geographic measurement scope is required.");
  if (!audienceLanguage) throw new Error("Target audience language is required.");
  return { brandName, officialWebsite: parsed.toString().replace(/\/$/, ""), geography, audienceLanguage, reportLanguage: reportLanguage || audienceLanguage };
}
function normalizeText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
export function containsBrandMention(answer: string | null, aliases: string[]): boolean {
  if (!answer) return false;
  const text = normalizeText(answer);
  return aliases.some((alias) => { const candidate = normalizeText(String(alias ?? "")); return candidate.length > 0 && text.includes(candidate); });
}
function isValidObservation(item: VisibilityObservation): boolean {
  return (item.status === "answered" || item.status === "cached") && typeof item.answer === "string" && item.answer.trim().length > 0;
}
function metric(numerator: number, denominator: number): MetricValue {
  return { numerator, denominator, value: denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null };
}
/**
 * Calculate transparent metrics from recorded observations. planned is the expected
 * number of observations; absent/failed runs reduce coverage but not visibility denominators.
 */
export function calculateVisibilityMetrics(args: { observations: VisibilityObservation[]; planned: number; brandAliases: string[] }): VisibilityMetrics {
  const observations = Array.isArray(args.observations) ? args.observations : [];
  const planned = Math.max(0, Math.floor(Number(args.planned) || 0));
  const valid = observations.filter(isValidObservation);
  const failed = observations.filter((x) => ["empty", "timeout", "error"].includes(x.status)).length;
  const unmeasured = Math.max(0, planned - observations.length) + observations.filter((x) => x.status === "not_run").length;
  const mentionCount = valid.filter((x) => containsBrandMention(x.answer, args.brandAliases)).length;
  const recommendationDenominator = valid.filter((x) => x.recommended !== null).length;
  const recommendationCount = valid.filter((x) => x.recommended === true).length;
  const ranked = valid.filter((x) => x.rankPosition !== null && Number.isFinite(x.rankPosition) && x.rankPosition > 0);
  const topFive = ranked.filter((x) => Number(x.rankPosition) <= 5).length;
  const aliases = new Set(args.brandAliases.map(normalizeText).filter(Boolean));
  const totalBrandMentions = valid.reduce((sum, x) => sum + new Set((x.brands || []).map(normalizeText).filter(Boolean)).size, 0);
  const targetMentions = valid.reduce((sum, x) => sum + [...new Set((x.brands || []).map(normalizeText).filter(Boolean))].filter((brand) => aliases.has(brand)).length, 0);
  return {
    planned, completed: valid.length, failed, unmeasured,
    coverage: metric(valid.length, planned),
    mentionRate: metric(mentionCount, valid.length),
    recommendationRate: metric(recommendationCount, recommendationDenominator),
    topFiveRate: metric(topFive, ranked.length),
    shareOfVoice: metric(targetMentions, totalBrandMentions),
  };
}
