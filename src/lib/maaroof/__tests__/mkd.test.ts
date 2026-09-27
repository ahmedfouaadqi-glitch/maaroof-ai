import { describe, it, expect } from "vitest";
import { dedupeCandidates, falsePositiveReason, normalizeName, relationTruth } from "../mkd";

describe("MKD helpers", () => {
  it("normalizes Arabic variants", () => {
    expect(normalizeName("شركة الأمانة")).toBe(normalizeName("الامانه"));
  });
  it("dedupes by domain and name", () => {
    const r = dedupeCandidates([
      { name: "Foo", domain: "https://www.foo.com", sources: ["a"], fromWeb: true, fromAi: false },
      { name: "FOO Inc", domain: null, sources: ["b"], fromWeb: false, fromAi: true },
      { name: "Bar", domain: "bar.com", sources: [], fromWeb: true, fromAi: false },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].fromAi && r[0].fromWeb).toBe(true);
    expect(r[0].sources).toEqual(["a", "b"]);
  });
  it("filters false positives", () => {
    const c = (name: string, domain?: string) => ({ name, domain, sources: [], fromWeb: true, fromAi: false });
    expect(falsePositiveReason(c("Facebook", "facebook.com"), "Acme")).toBe("platform");
    expect(falsePositiveReason(c("Acme"), "acme")).toBe("self");
    expect(falsePositiveReason(c("Rival Co", "rival.com"), "Acme")).toBeNull();
  });
  it("AI-only observations are never verified", () => {
    const t = relationTruth({ category: "direct", confidence: 99, fromWeb: false, fromAi: true, sourceCount: 0 });
    expect(t.verification_state).toBe("inferred");
    expect(t.is_ai_observation).toBe(true);
    expect(t.confidence).toBeLessThanOrEqual(45);
    const w = relationTruth({ category: "weird", confidence: 99, fromWeb: true, fromAi: false, sourceCount: 2 });
    expect(w.verification_state).toBe("observed");
    expect(w.category).toBe("indirect");
    expect(w.confidence).toBeLessThanOrEqual(64);
  });
});
