import { describe, expect, it } from "vitest";
import { calculateVisibilityProbeMetrics } from "./visibility-metrics";

describe("calculateVisibilityProbeMetrics", () => {
  it("separates engine coverage, mentions, recommendations, share of voice and verified citations", () => {
    const metrics = calculateVisibilityProbeMetrics("Acme Couture", ["chatgpt", "gemini", "claude"], [
      {
        engine: "chatgpt",
        answer: "Acme Couture is a possible option.",
        mentioned: true,
        rank: 2,
        brands: ["Other Brand", "Acme Couture", "Other Brand"],
        cited_urls: ["https://acme.example/about"],
        sources: [{ url: "https://acme.example/about", title: "About Acme" }],
      },
      {
        engine: "gemini",
        answer: "I recommend Acme Couture.",
        mentioned: true,
        rank: 1,
        brands: ["Acme Couture", "Second Brand"],
        cited_urls: ["https://made-up.example"],
        sources: [{ url: "https://acme.example/about", title: "About Acme" }],
      },
      { engine: "claude", answer: "No matching brand was identified.", mentioned: false, rank: null, brands: [] },
    ]);

    expect(metrics.engine_coverage).toEqual({ value_pct: 100, numerator: 3, denominator: 3 });
    expect(metrics.mention_rate.value_pct).toBe(66.67);
    expect(metrics.recommendation_rate.value_pct).toBe(66.67);
    expect(metrics.share_of_voice).toEqual({ value_pct: 50, numerator: 2, denominator: 4 });
    expect(metrics.citation_rate).toEqual({ value_pct: 33.33, numerator: 1, denominator: 3 });
    expect(metrics.top5_rate).toEqual({ value_pct: 100, numerator: 2, denominator: 2 });
    expect(metrics.average_rank).toBe(1.5);
  });

  it("does not count failed or empty responses as negative visibility observations", () => {
    const metrics = calculateVisibilityProbeMetrics("Acme", ["chatgpt", "gemini"], [
      { engine: "chatgpt", answer: "Acme is relevant.", mentioned: true, brands: ["Acme"] },
      { engine: "gemini", answer: "", mentioned: false, brands: [] },
    ]);

    expect(metrics.engine_coverage).toEqual({ value_pct: 50, numerator: 1, denominator: 2 });
    expect(metrics.mention_coverage).toEqual({ value_pct: 100, numerator: 1, denominator: 1 });
  });

  it("returns null for undefined ratios when there is no valid denominator", () => {
    const metrics = calculateVisibilityProbeMetrics("Acme", ["chatgpt"], []);
    expect(metrics.engine_coverage.value_pct).toBe(0);
    expect(metrics.mention_coverage.value_pct).toBeNull();
    expect(metrics.share_of_voice.value_pct).toBeNull();
    expect(metrics.citation_rate.value_pct).toBeNull();
    expect(metrics.average_rank).toBeNull();
  });

  it("normalizes case and punctuation when matching brand names", () => {
    const metrics = calculateVisibilityProbeMetrics("ACME-Couture", ["chatgpt"], [
      { engine: "chatgpt", answer: "ACME Couture appears here.", brands: ["acme couture"] },
    ]);
    expect(metrics.mentioned_answers).toBe(1);
    expect(metrics.recommended_answers).toBe(1);
  });
});
