import { describe, it, expect } from "vitest";
import {
  planSourceRoute, normalizeSourceEvidence, aggregateVisibilityMetrics,
  measurementSignature, canExecuteSpecializedSource, estimateSearchCredits,
} from "./source-intelligence";

describe("Source Intelligence Router", () => {
  it("selects a single general web route by default and never executes a specialized source", () => {
    const plan = planSourceRoute({ goal: "Research public information", budget: { maxRequests: 1, maxEstimatedCredits: 2 } });
    expect(plan.primary).toBe("web");
    expect(plan.searchSources).toEqual(["web"]);
    expect(plan.executeSpecializedSource).toBe(false);
    expect(plan.requestsAvailable).toBe(1);
  });

  it("uses a news-aware route for recent queries without increasing the call budget", () => {
    const plan = planSourceRoute({ goal: "latest news about the Iraqi mobile market", budget: { maxRequests: 1, maxEstimatedCredits: 2 } });
    expect(plan.primary).toBe("news");
    expect(plan.searchSources).toEqual(["web", "news"]);
    expect(plan.maxRequests).toBe(1);
  });

  it("fails closed when budget is exhausted", () => {
    const plan = planSourceRoute({
      goal: "research market trends",
      budget: { maxRequests: 1, maxEstimatedCredits: 2, usedRequests: 1, usedEstimatedCredits: 2 },
    });
    expect(plan.primary).toBe("none");
    expect(plan.limitations).toContain("request_budget_exhausted");
  });

  it("allows only explicit Alexandria catalogue discovery and never auto-executes it", () => {
    const off = planSourceRoute({ goal: "market size", capability: "market_intelligence", available: { alexandria: true } });
    expect(off.discoverSpecializedSources).toBe(false);
    const on = planSourceRoute({
      goal: "market size", capability: "market_intelligence",
      available: { alexandria: true }, requestSpecializedDiscovery: true,
      budget: { maxRequests: 1, maxEstimatedCredits: 0 },
    });
    expect(on.discoverSpecializedSources).toBe(true);
    expect(on.executeSpecializedSource).toBe(false);
  });

  it("normalizes source metadata and marks unknown kinds honestly", () => {
    const item = normalizeSourceEvidence({
      provider: "public_web", capability: "web_search", sourceRef: "https://example.com",
      retrievedAt: "2026-10-25T10:00:00.000Z", sampleSize: -4, realityKind: "bogus" as any,
      status: "success", sourceReliability: 140, relevanceScore: 41, businessImportance: 88,
    });
    expect(item.sampleSize).toBe(0);
    expect(item.realityKind).toBe("unverified");
    expect(item.sourceReliability).toBe(100);
    expect(item.relevanceScore).toBe(41);
    expect(item.businessImportance).toBe(88);
  });

  it("excludes failed probes from rates and reports coverage separately", () => {
    const m = aggregateVisibilityMetrics([
      { status: "success", mentioned: true, cited: false, position: 2 },
      { status: "success", mentioned: false, cited: false, position: 4 },
      { status: "failed" },
      { status: "unavailable" },
    ]);
    expect(m.attempted).toBe(4);
    expect(m.successful).toBe(2);
    expect(m.coverageRate).toBe(50);
    expect(m.mentionRate).toBe(50);
    expect(m.citationRate).toBe(0);
    expect(m.averagePosition).toBe(3);
  });

  it("creates comparable signatures independent of array ordering", () => {
    const a = measurementSignature({ prompts: ["Brand?" , "What is X?"], language: "AR", market: "IQ", engines: ["Gemini", "ChatGPT"], methodVersion: "v1" });
    const b = measurementSignature({ prompts: ["what is x?", "brand?"], language: "ar", market: "iq", engines: ["ChatGPT", "Gemini"], methodVersion: "v1" });
    expect(a).toBe(b);
  });

  it("requires explicit approval, accepted terms, known cost, cap and idempotency key", () => {
    const base = { discoveredCostCredits: 3, maxCredits: 4, userConfirmedPaidRun: true, adminTermsAccepted: true, requestId: "run-123" };
    expect(canExecuteSpecializedSource(base)).toEqual({ allowed: true, reason: null });
    expect(canExecuteSpecializedSource({ ...base, userConfirmedPaidRun: false }).reason).toBe("explicit_user_approval_required");
    expect(canExecuteSpecializedSource({ ...base, adminTermsAccepted: false }).reason).toBe("organization_terms_not_confirmed");
    expect(canExecuteSpecializedSource({ ...base, discoveredCostCredits: null }).reason).toBe("unknown_cost_fails_closed");
    expect(canExecuteSpecializedSource({ ...base, maxCredits: 2 }).reason).toBe("cost_cap_exceeded");
    expect(canExecuteSpecializedSource({ ...base, requestId: "" }).reason).toBe("idempotency_key_required");
  });

  it("estimates result-search and page-read costs separately and treats catalog discovery as free", () => {
    expect(estimateSearchCredits({ resultCount: 8, sources: ["web"], includePageContent: true })).toEqual({
      queryCredits: 2, pageCredits: 8, estimatedCredits: 10, billable: true,
    });
    expect(estimateSearchCredits({ resultCount: 18, sources: ["web", "news"], includePageContent: true })).toEqual({
      queryCredits: 4, pageCredits: 18, estimatedCredits: 22, billable: true,
    });
    expect(estimateSearchCredits({ resultCount: 4, sources: ["alexandria"] })).toEqual({
      queryCredits: 0, pageCredits: 0, estimatedCredits: 0, billable: false,
    });
  });
});
