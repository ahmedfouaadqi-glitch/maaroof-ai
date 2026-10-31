import { describe, expect, it } from "vitest";
import { calculateVisibilityQueryPackMetrics, type QueryPackKind } from "./visibility-query-pack-metrics";

const kinds: QueryPackKind[] = ["blind_discovery", "brand_recognition", "recommendation", "comparison", "fact_verification", "purchase_intent"];

describe("calculateVisibilityQueryPackMetrics", () => {
  it("keeps organic mention measurement separate from brand-primed scenarios", () => {
    const result = calculateVisibilityQueryPackMetrics("Acme", ["A", "B"], kinds, [
      {
        engine: "A", answer: "Recommend Acme naturally", brands: ["Acme", "Other"], blind_status: "answered", grounded_status: "ok",
        query_observations: kinds.slice(1).map((kind) => ({
          kind,
          answer: kind === "recommendation" ? "Acme is recommended" : "Acme has been assessed",
          brands: kind === "recommendation" ? ["Acme"] : [],
          outcome: kind === "recommendation" ? "recommended" : kind === "brand_recognition" ? "recognized" : "unknown",
          evidence_level: kind === "fact_verification" ? "partially_verified" : undefined,
        })),
      },
      { engine: "B", answer: "", brands: [], blind_status: "timeout", grounded_status: "not_run" },
    ], { A: { blind_status: "answered", grounded_status: "ok" }, B: { blind_status: "timeout" } });

    expect(result.planned).toBe(12);
    expect(result.answered).toBe(6);
    expect(result.failed).toBe(1);
    expect(result.unmeasured).toBe(5);
    expect(result.organic_mention_rate).toEqual({ numerator: 1, denominator: 1, value_pct: 100 });
    expect(result.recommendation_rate).toEqual({ numerator: 1, denominator: 1, value_pct: 100 });
    expect(result.by_query.find((item) => item.kind === "brand_recognition")?.organic_mention_rate).toBeNull();
    expect(result.by_query.find((item) => item.kind === "fact_verification")?.verified_evidence_rate).toEqual({ numerator: 0, denominator: 1, value_pct: 0 });
  });

  it("returns null for unmeasured blind-discovery and recommendation denominators", () => {
    const result = calculateVisibilityQueryPackMetrics("Acme", ["A"], kinds, [], { A: { blind_status: "timeout" } });
    expect(result.coverage.value_pct).toBe(0);
    expect(result.organic_mention_rate.value_pct).toBeNull();
    expect(result.recommendation_rate.value_pct).toBeNull();
    expect(result.share_of_voice.value_pct).toBeNull();
  });

  it("uses ranked blind-discovery lists only for top-five and share-of-voice calculations", () => {
    const result = calculateVisibilityQueryPackMetrics("Acme", ["A"], kinds, [
      { engine: "A", answer: "Acme is one of the options.", brands: ["Acme", "B"], blind_status: "answered", grounded_status: "ok",
        query_observations: [{ kind: "recommendation", answer: "Acme is the best option", brands: ["Acme"], outcome: "recommended" }] },
    ], { A: { blind_status: "answered", grounded_status: "ok" } });
    expect(result.top_five_rate).toEqual({ numerator: 1, denominator: 1, value_pct: 100 });
    expect(result.share_of_voice).toEqual({ numerator: 1, denominator: 2, value_pct: 50 });
  });
});
