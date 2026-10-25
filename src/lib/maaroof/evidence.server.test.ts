import { describe, it, expect } from "vitest";
import { assessEvidenceDimensions, crossValidate, weighEvidence } from "./evidence.server";

describe("evidence dimensions", () => {
  it("keeps business importance from changing evidence quality", () => {
    const weakImportance = weighEvidence({ evidenceType: "external", sourceReliability: 70, freshness: 90, businessValue: 5 });
    const highImportance = weighEvidence({ evidenceType: "external", sourceReliability: 70, freshness: 90, businessValue: 100 });
    expect(highImportance).toBe(weakImportance);
  });

  it("returns quality, relevance and business importance separately", () => {
    const low = assessEvidenceDimensions({ evidenceType: "external", sourceReliability: 75, relevanceScore: 20, businessImportance: 90 });
    const high = assessEvidenceDimensions({ evidenceType: "external", sourceReliability: 75, relevanceScore: 95, businessImportance: 10 });
    expect(high.quality).toBe(low.quality);
    expect(high.relevance).toBeGreaterThan(low.relevance);
    expect(high.businessImportance).toBeLessThan(low.businessImportance);
  });

  it("does not treat multiple pages on one domain as independent sources", () => {
    const result = crossValidate([
      { source_kind: "external", source_ref: "https://example.com/a", evidence_type: "external", weight: 90, source_reliability: 80, freshness: 90 },
      { source_kind: "external", source_ref: "https://www.example.com/b", evidence_type: "external", weight: 90, source_reliability: 80, freshness: 90 },
      { source_kind: "external", source_ref: "https://another.example.org/fact", evidence_type: "external", weight: 70, source_reliability: 70, freshness: 80 },
    ]);
    expect(result.independent_sources).toBe(2);
  });
});
