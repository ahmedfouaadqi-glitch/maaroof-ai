import { describe, expect, it } from "vitest";
import { calculateSocialVisibilityMetrics } from "./social-visibility-metrics";

describe("calculateSocialVisibilityMetrics", () => {
  it("distinguishes a successful empty search from a failed search", () => {
    const result = calculateSocialVisibilityMetrics([
      { key: "x", status: "measured", results: [] },
      { key: "instagram", status: "error", results: [] },
    ]);
    expect(result.query_coverage).toEqual({ numerator: 1, denominator: 2, value_pct: 50 });
    expect(result.total_results_returned).toBe(0);
    expect(result.failed_queries).toBe(1);
  });

  it("counts returned sample records but deduplicates source URLs separately", () => {
    const result = calculateSocialVisibilityMetrics([
      { key: "x", status: "measured", results: [{ url: "https://example.com/a" }, { url: "https://example.com/b" }] },
      { key: "reddit", status: "measured", results: [{ url: "https://example.com/a" }] },
    ]);
    expect(result.total_results_returned).toBe(3);
    expect(result.unique_result_urls).toBe(2);
    expect(result.query_coverage.value_pct).toBe(100);
  });

  it("does not invent share of voice without a competitor denominator", () => {
    const result = calculateSocialVisibilityMetrics([]);
    expect(result.share_of_voice).toBeNull();
    expect(result.share_of_voice_basis).toContain("competitor");
    expect(result.query_coverage.value_pct).toBeNull();
  });
});
