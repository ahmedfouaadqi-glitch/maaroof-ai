import { describe, expect, it } from "vitest";
import { createInsight, discoverFact, type FactCandidate } from "./fact-discovery";

const evidence = {
  source_kind: "website_page",
  source_ref: "https://shop.example/about",
  locator: "h1",
  excerpt: "Shop Example",
  collected_at: "2026-11-15T10:00:00.000Z",
  collection_method: "public_http_scrape",
};

const base: FactCandidate = {
  key: "brand-name",
  subject: "shop.example",
  predicate: "brand_name",
  value: "Shop Example",
  kind: "observed_fact",
  evidence: [evidence],
};

describe("evidence-first fact discovery", () => {
  it("accepts directly observed facts only when evidence is traceable", () => {
    const fact = discoverFact(base);
    expect(fact.status).toBe("supported");
    expect(fact.normalized_key).toBe("shop.example::brand_name::shop example");
  });

  it("rejects unsupported claims rather than treating model output as fact", () => {
    const fact = discoverFact({ ...base, evidence: [] });
    expect(fact.status).toBe("rejected");
    expect(fact.validation_errors).toContain("evidence_required");
  });

  it("requires formula and source fact keys for computed facts", () => {
    const fact = discoverFact({ ...base, kind: "computed_fact" });
    expect(fact.status).toBe("rejected");
    expect(fact.validation_errors).toContain("computed_formula_required");
    expect(fact.validation_errors).toContain("computed_inputs_required");
  });

  it("keeps inferences and hypotheses separate from supported observations", () => {
    const fact = discoverFact({ ...base, kind: "hypothesis", rationale: "Derived from category signals" });
    expect(fact.status).toBe("needs_validation");
  });

  it("links insights only to non-rejected evidence-backed facts", () => {
    const supported = discoverFact(base);
    const rejected = discoverFact({ ...base, key: "unsupported", evidence: [] });
    const insight = createInsight({
      id: "insight-1",
      kind: "information_gap",
      title: "Country not established",
      explanation: "The available page evidence does not establish a country.",
      facts: [supported, rejected],
    });
    expect(insight?.fact_keys).toEqual(["brand-name"]);
    expect(insight?.status).toBe("evidence_linked");
  });

  it("does not create an insight without linked evidence", () => {
    expect(createInsight({
      id: "empty",
      kind: "risk",
      title: "Unsupported",
      explanation: "No source.",
      facts: [],
    })).toBeNull();
  });
});
