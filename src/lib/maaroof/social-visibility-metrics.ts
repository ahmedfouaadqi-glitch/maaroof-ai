/**
 * Transparent metrics for social search-result samples.
 * A successful query returning no records is measured zero; a failed query is unmeasured.
 * Search-result records are not platform-wide post counts, impressions, or reach.
 */
export type SocialPlatformSample = {
  key: string;
  status: "measured" | "error";
  results: Array<{ url?: string | null }>;
};

export type SocialMetricValue = {
  numerator: number;
  denominator: number;
  value_pct: number | null;
};

export type SocialVisibilityMetrics = {
  planned_queries: number;
  completed_queries: number;
  failed_queries: number;
  query_coverage: SocialMetricValue;
  total_results_returned: number;
  unique_result_urls: number;
  share_of_voice: null;
  share_of_voice_basis: string;
};

export function calculateSocialVisibilityMetrics(samples: SocialPlatformSample[]): SocialVisibilityMetrics {
  const rows = Array.isArray(samples) ? samples : [];
  const completed = rows.filter((sample) => sample.status === "measured");
  const failed = rows.filter((sample) => sample.status === "error");
  const urls = completed.flatMap((sample) => sample.results || [])
    .map((result) => String(result?.url || "").trim())
    .filter((url) => url.startsWith("https://") || url.startsWith("http://"));
  return {
    planned_queries: rows.length,
    completed_queries: completed.length,
    failed_queries: failed.length,
    query_coverage: {
      numerator: completed.length,
      denominator: rows.length,
      value_pct: rows.length ? Number(((completed.length / rows.length) * 100).toFixed(2)) : null,
    },
    total_results_returned: completed.reduce((sum, sample) => sum + (sample.results?.length || 0), 0),
    unique_result_urls: new Set(urls).size,
    share_of_voice: null,
    share_of_voice_basis: "not_measured: requires comparable competitor results and a defined denominator",
  };
}
