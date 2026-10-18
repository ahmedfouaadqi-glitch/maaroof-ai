import { describe, expect, it } from "vitest";
import {
  hasValidPlatformScores,
  normalizePlatforms,
  normalizeResult,
} from "@/lib/visibility-normalization";

const names = [
  "ChatGPT",
  "Gemini",
  "Claude",
  "Perplexity",
  "Copilot",
  "Grok",
  "Mistral",
  "DeepSeek",
  "Kimi",
  "Qwen",
];

describe("visibility report normalization", () => {
  it("returns one canonical entry for each supported engine and ignores unknown engines", () => {
    const platforms = normalizePlatforms([
      { name: "ChatGPT", score: 73, citation_likelihood: "high" },
      { name: "ChatGPT", score: 61 },
      { name: "Unknown Engine", score: 100 },
      null,
    ]);
    expect(platforms.map((platform) => platform.name)).toEqual(names);
    expect(platforms.find((platform) => platform.name === "ChatGPT")?.score).toBe(61);
    expect(platforms.find((platform) => platform.name === "Kimi")?.score).toBe(0);
  });

  it("clamps malformed and out-of-range scores without accepting numeric prefixes", () => {
    const platforms = normalizePlatforms([
      { name: "ChatGPT", score: 140 },
      { name: "Gemini", score: -4 },
      { name: "Claude", score: "42garbage" },
      { name: "Perplexity", score: "37" },
    ]);
    expect(platforms.slice(0, 4).map((platform) => platform.score)).toEqual([100, 0, 0, 37]);
  });

  it("rejects incomplete or out-of-range engine scores before a report is accepted", () => {
    const complete = names.map((name) => ({ name, score: 42 }));
    expect(hasValidPlatformScores(complete)).toBe(true);
    expect(hasValidPlatformScores(complete.slice(1))).toBe(false);
    const outOfRange = complete.map((platform, index) => ({
      ...platform,
      score: index === 0 ? 140 : platform.score,
    }));
    const malformed = complete.map((platform, index) => ({
      ...platform,
      score: index === 0 ? "unknown" : platform.score,
    }));
    expect(hasValidPlatformScores(outOfRange)).toBe(false);
    expect(hasValidPlatformScores(malformed)).toBe(false);
    expect(
      hasValidPlatformScores(
        complete.map((platform, index) => ({
          ...platform,
          score: index === 0 ? "   " : platform.score,
        })),
      ),
    ).toBe(false);
    expect(
      hasValidPlatformScores(
        complete.map((platform, index) => ({
          ...platform,
          score: index === 0 ? true : platform.score,
        })),
      ),
    ).toBe(false);
  });

  it("derives the headline visibility score from all ten platform scores", () => {
    const platforms = names.map((name, index) => ({
      name,
      score: (index + 1) * 10,
    }));
    const result = normalizeResult({ visibility_percent: 99, platforms });
    expect(result.visibility_percent).toBe(55);
    expect(result.platforms).toHaveLength(10);
  });

  it("preserves a true zero score and bounds user-facing text arrays", () => {
    const result = normalizeResult({
      visibility_percent: 0,
      platforms: names.map((name) => ({ name, score: 0 })),
      strengths: ["  first  ", "second", "", null, "third"],
      recommendations: Array.from({ length: 12 }, (_, index) => "action " + index),
    });
    expect(result.visibility_percent).toBe(0);
    expect(result.strengths).toEqual(["first", "second", "third"]);
    expect(result.recommendations).toHaveLength(8);
  });
});
