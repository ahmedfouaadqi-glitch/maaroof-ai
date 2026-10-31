import { describe, expect, it } from "vitest";
import { keywordVisibilityProbeQuestion } from "./probe-answer";

describe("keywordVisibilityProbeQuestion", () => {
  it("grounds a blind market test in actual keyword phrases without priming the target brand", () => {
    const q = keywordVisibilityProbeQuestion("Luxury fashion & couture", "United States", ["designer evening gowns", "Mengotti couture dresses"]);
    expect(q).toContain("United States");
    expect(q).toContain('"designer evening gowns"');
    expect(q).toContain('"Mengotti couture dresses"');
    expect(q).toContain("do not recommend SEO agencies");
    expect(q).not.toContain("target brand is Mengotti");
  });

  it("deduplicates keywords and caps the prompt to eight phrases", () => {
    const q = keywordVisibilityProbeQuestion("Fashion", "Lebanon", ["dress", "dress", "bag", "shoe", "coat", "gown", "hat", "belt", "scarf", "jacket"]);
    expect((q.match(/"dress"/g) || []).length).toBe(1);
    expect(q).toContain('"belt"');
    expect(q).toContain('"scarf"');
    expect(q).not.toContain('"jacket"');
  });

  it("keeps content language separate from the geographic market", () => {
    const q = keywordVisibilityProbeQuestion("Fashion", "Saudi Arabia", ["evening gown"], "ar");
    expect(q).toContain("في سوق Saudi Arabia");
    expect(q).toContain('"evening gown"');
    expect(q).not.toContain("What are the best");
  });

  it("does not invent a keyword list when no keyword samples are supplied", () => {
    const q = keywordVisibilityProbeQuestion("Fashion", "Australia");
    expect(q).toContain("Fashion");
    expect(q).toContain("Australia");
  });
});

describe("parseProbeContent query observations", () => {
  it("preserves the five structured branded scenarios and their evidence URLs", async () => {
    const { parseProbeContent } = await import("./probe-answer");
    const parsed = parseProbeContent(JSON.stringify({
      answer: "Evidence audit: public evidence is limited.",
      brands: [],
      urls: ["https://official.example"],
      query_observations: [
        { kind: "brand_recognition", answer: "The brand has an official website.", brands: [], urls: ["https://official.example"] },
        { kind: "recommendation", answer: "Could be considered for couture.", brands: ["Acme Couture"], urls: [] },
        { kind: "comparison", answer: "Compare quality and delivery.", brands: ["Acme Couture", "Other Couture"], urls: [] },
        { kind: "fact_verification", answer: "Shipping terms are not verified.", brands: [], urls: [] },
        { kind: "purchase_intent", answer: "Availability in the market is unknown.", brands: [], urls: [] },
      ],
    }));
    expect(parsed?.query_observations).toHaveLength(5);
    expect(parsed?.query_observations?.map((item) => item.kind)).toEqual([
      "brand_recognition", "recommendation", "comparison", "fact_verification", "purchase_intent",
    ]);
    expect(parsed?.urls).toContain("https://official.example");
    expect(parsed?.query_observations?.[0].urls).toContain("https://official.example");
  });

  it("rejects empty scenario observations and unsafe non-http URLs", async () => {
    const { parseProbeContent } = await import("./probe-answer");
    const parsed = parseProbeContent(JSON.stringify({
      answer: "Audit completed.",
      query_observations: [
        { kind: "recommendation", answer: "", brands: [], urls: ["javascript:alert(1)"] },
      ],
    }));
    expect(parsed?.query_observations).toEqual([]);
    expect(parsed?.urls).toEqual([]);
  });
});
