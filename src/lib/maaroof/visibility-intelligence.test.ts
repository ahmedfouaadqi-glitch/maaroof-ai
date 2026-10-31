import { describe, expect, it } from "vitest";
import { calculateVisibilityMetrics, containsBrandMention, normalizeVisibilityScope, type VisibilityObservation } from "./visibility-intelligence";
const row = (overrides: Partial<VisibilityObservation> = {}): VisibilityObservation => ({
  engine: "engine-a", queryId: "q-1", status: "answered", answer: "Consider Acme Studio.",
  recommended: true, rankPosition: 2, brands: ["Acme Studio", "Other Brand"], observedAt: "2026-10-31T00:00:00.000Z", ...overrides,
});
describe("normalizeVisibilityScope", () => {
  it("keeps audience language distinct and normalizes inputs", () => {
    expect(normalizeVisibilityScope({ brandName: " Acme  Studio ", officialWebsite: "https://example.com/", geography: " Global ", audienceLanguage: "EN" })).toEqual({
      brandName: "Acme Studio", officialWebsite: "https://example.com", geography: "Global", audienceLanguage: "en", reportLanguage: "en",
    });
  });
  it("rejects unsafe URL protocols", () => {
    expect(() => normalizeVisibilityScope({ brandName: "Acme", officialWebsite: "javascript:alert(1)", geography: "Global", audienceLanguage: "en" })).toThrow(/HTTP or HTTPS/);
  });
});
describe("calculateVisibilityMetrics", () => {
  it("does not count failed or unrun calls as no-mention answers", () => {
    const result = calculateVisibilityMetrics({ planned: 4, brandAliases: ["Acme Studio"], observations: [
      row(), row({ queryId: "q-2", status: "timeout", answer: null, recommended: null, rankPosition: null, brands: [] }),
      row({ queryId: "q-3", status: "not_run", answer: null, recommended: null, rankPosition: null, brands: [] }),
    ] });
    expect(result.coverage).toEqual({ numerator: 1, denominator: 4, value: 25 });
    expect(result.mentionRate).toEqual({ numerator: 1, denominator: 1, value: 100 });
    expect(result.failed).toBe(1);
    expect(result.unmeasured).toBe(2);
  });
  it("keeps recommendation and ranking metrics separate", () => {
    const result = calculateVisibilityMetrics({ planned: 2, brandAliases: ["Acme Studio"], observations: [
      row({ recommended: false, rankPosition: 8 }), row({ queryId: "q-2", recommended: true, rankPosition: 3 }),
    ] });
    expect(result.recommendationRate).toEqual({ numerator: 1, denominator: 2, value: 50 });
    expect(result.topFiveRate).toEqual({ numerator: 1, denominator: 2, value: 50 });
  });
  it("returns null for metrics with no valid denominator", () => {
    const result = calculateVisibilityMetrics({ planned: 2, brandAliases: ["Acme"], observations: [] });
    expect(result.mentionRate.value).toBeNull();
    expect(result.recommendationRate.value).toBeNull();
    expect(result.topFiveRate.value).toBeNull();
    expect(result.shareOfVoice.value).toBeNull();
  });
  it("normalizes brand text for literal matching", () => {
    expect(containsBrandMention("Recommended: ACME   STUDIO", ["Acme Studio"])).toBe(true);
    expect(containsBrandMention("No provider found.", ["Acme Studio"])).toBe(false);
  });
});
