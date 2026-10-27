import { describe, expect, it } from "vitest";
import { keywordVisibilityProbeQuestion } from "./probe-answer";

describe("keywordVisibilityProbeQuestion", () => {
  it("grounds a blind market test in actual keyword phrases without priming the target brand", () => {
    const q = keywordVisibilityProbeQuestion("Luxury fashion & couture", "United States", ["designer evening gowns", "Mengotti couture dresses"]);
    expect(q).toContain("United States");
    expect(q).toContain('"designer evening gowns"');
    expect(q).toContain('"Mengotti couture dresses"');
    expect(q).toContain("do not switch to SEO tools");
    expect(q).not.toContain("target brand is Mengotti");
  });

  it("deduplicates keywords and caps the prompt to eight phrases", () => {
    const q = keywordVisibilityProbeQuestion("Fashion", "Lebanon", ["dress", "dress", "bag", "shoe", "coat", "gown", "hat", "belt", "scarf", "jacket"]);
    expect((q.match(/"dress"/g) || []).length).toBe(1);
    expect(q).toContain('"belt"');
    expect(q).toContain('"scarf"');
    expect(q).not.toContain('"jacket"');
  });

  it("does not invent a keyword list when no keyword samples are supplied", () => {
    const q = keywordVisibilityProbeQuestion("Fashion", "Australia");
    expect(q).toContain("Use the category to understand the search context.");
  });
});
