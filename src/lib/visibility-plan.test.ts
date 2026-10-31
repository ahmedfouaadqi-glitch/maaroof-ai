import { describe, it, expect } from "vitest";
import { buildVisibilityWorkbook, blindRecommendationRate, directRecognitionRate, competitorShares } from "./visibility-workbook";
import { discoverFromSite } from "./site-discovery";
import { compareToBaseline } from "./visibility-baseline";

const answers = [
  { engine: "a", mentioned: false, answer: "Sephora, L'Oreal", grounded_answer: "Mengotti is a couture brand", brands: ["Sephora", "L'Oreal"] },
  { engine: "b", mentioned: true, answer: "Mengotti, Sephora", grounded_answer: "I don't know", brands: ["Mengotti", "Sephora"] },
];

describe("dual probe rates", () => {
  it("blind rate counts brand named in blind answers", () => expect(blindRecommendationRate("Mengotti", answers).value_pct).toBe(50));
  it("direct rate counts brand named in branded answers", () => expect(directRecognitionRate("Mengotti", answers).value_pct).toBe(50));
  it("no answers is not measured", () => expect(directRecognitionRate("x", []).value_pct).toBeNull());
  it("competitor share excludes own brand", () => {
    const c = competitorShares("Mengotti", answers);
    expect(c[0]).toMatchObject({ name: "Sephora" });
    expect(c[0].share.value_pct).toBe(100);
    expect(c.find((x) => x.name === "Mengotti")).toBeUndefined();
  });
});

describe("workbook", () => {
  it("has three sheets and lists unanswered engines as not measured", () => {
    const s = buildVisibilityWorkbook("Mengotti", { asked: ["a", "b", "c"], answers }, "en");
    expect(s).toHaveLength(3);
    expect(s[1].rows.some((r) => r[0] === "c" && r[1] === "Not measured")).toBe(true);
    expect(s[2].rows[1][0]).toBe("Not measured");
  });
});

describe("site discovery", () => {
  it("tags site links verified, given-only unverified, skips share links", () => {
    const items = discoverFromSite({ links: ["https://instagram.com/brand/", "https://facebook.com/sharer/sharer.php?u=x"], knownSocials: ["https://tiktok.com/@brand"], markdown: "## Dresses" });
    expect(items).toEqual([
      { kind: "social", value: "https://instagram.com/brand", platform: "instagram", status: "verified" },
      { kind: "social", value: "https://tiktok.com/@brand", platform: "tiktok", status: "unverified" },
      { kind: "category", value: "Dresses", status: "inferred" },
    ]);
  });
});

describe("baseline", () => {
  it("reports per-engine change and new evidence", () => {
    const r = compareToBaseline(
      { engines: [{ engine: "a", mentioned: false }], evidence_urls: ["u1"], mention_pct: 0 },
      { engines: [{ engine: "a", mentioned: true }, { engine: "b", mentioned: false }], evidence_urls: ["u1", "u2"], mention_pct: 50 },
    );
    expect(r.engines.map((e) => e.change)).toEqual(["gained", "not_comparable"]);
    expect(r.newEvidence).toEqual(["u2"]);
    expect(r.delta).toBe(50);
  });
});
