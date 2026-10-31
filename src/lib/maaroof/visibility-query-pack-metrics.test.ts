import { describe, expect, it } from "vitest";
import { calculateVisibilityQueryPackMetrics, type QueryPackKind } from "./visibility-query-pack-metrics";

const kinds: QueryPackKind[] = ["blind_discovery", "brand_recognition", "recommendation", "comparison", "fact_verification", "purchase_intent"];

describe("calculateVisibilityQueryPackMetrics", () => {
  it("measures each query kind separately and preserves failures", () => {
    const result = calculateVisibilityQueryPackMetrics("Acme", ["A", "B"], kinds, [
      { engine: "A", answer: "Recommend Acme", brands: ["Acme", "Other"], blind_status: "answered", grounded_status: "answered",
        query_observations: kinds.slice(1).map((kind) => ({ kind, answer: kind === "recommendation" ? "Acme is a fit" : "Acme has a listing", brands: kind === "recommendation" ? ["Acme"] : [] })) },
      { engine: "B", answer: "", brands: [], blind_status: "timeout", grounded_status: "not_run" },
    ], { A: { blind_status: "answered", grounded_status: "answered" }, B: { blind_status: "timeout" } });
    expect(result.planned).toBe(12);
    expect(result.answered).toBe(6);
    expect(result.failed).toBe(1);
    expect(result.unmeasured).toBe(5);
    expect(result.by_query.find((item) => item.kind === "recommendation")?.answered).toBe(1);
    expect(result.recommendation_rate).toEqual({ numerator: 1, denominator: 1, value_pct: 100 });
  });

  it("returns null for an unmeasured denominator", () => {
    const result = calculateVisibilityQueryPackMetrics("Acme", ["A"], kinds, [], { A: { blind_status: "timeout" } });
    expect(result.coverage.value_pct).toBe(0);
    expect(result.mention_rate.value_pct).toBeNull();
    expect(result.share_of_voice.value_pct).toBeNull();
  });
});
