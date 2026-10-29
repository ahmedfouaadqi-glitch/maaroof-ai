import { describe, expect, it } from "vitest";
import { measureKeywordAxes, type LiveSearchEvidence } from "./live-keyword-axes";
import { ENGINE_COUNCIL_MODELS } from "./maaroof/tool-council";

const keyword = "designer dress";
const modelAnswers = ENGINE_COUNCIL_MODELS.map((engine, index) => ({
  market: "sa",
  engine: engine.key,
  status: "answered" as const,
  answer: index < 7 ? "Acme is a relevant provider." : "Other providers are available.",
  urls: [],
  query: 'Search phrase: "' + keyword + '"',
  provider_path: "primary" as const,
}));

const liveEvidence: LiveSearchEvidence = {
  keyword,
  market: "sa",
  query: keyword + " Saudi Arabia",
  status: "measured",
  provider: "test_provider",
  results: Array.from({ length: 10 }, (_, i) => ({
    url: i === 2 ? "https://shop.example.sa/products/dress" : "https://result" + (i + 1) + ".example/",
    title: "Search result " + (i + 1),
  })),
  answerBoxChecked: false,
  answerBoxCitations: [],
  aiOverviewChecked: false,
  aiOverviewCitations: [],
};

describe("live keyword axis measurements", () => {
  it("does not score unrequested search checking", () => {
    const result = measureKeywordAxes({
      keyword, market: "sa", brand: "Acme", site: "https://shop.example.sa",
      engineAnswers: modelAnswers, liveSerpRequested: false,
    });
    expect(result.SEO.value).toBeNull();
    expect(result.SEO.reason).toBe("live_search_not_requested");
  });

  it("measures SEO rank only from the returned result order and records the evidence URL", () => {
    const result = measureKeywordAxes({
      keyword, market: "sa", brand: "Acme", site: "https://shop.example.sa",
      engineAnswers: modelAnswers, liveSearchEvidence: [liveEvidence], liveSerpRequested: true,
    });
    expect(result.SEO).toMatchObject({
      value: 3,
      position: 3,
      evidenceUrl: "https://shop.example.sa/products/dress",
    });
  });

  it("uses the fixed ten-engine denominator and lists the engines mentioning the brand", () => {
    const result = measureKeywordAxes({
      keyword, market: "sa", brand: "Acme", site: "https://shop.example.sa",
      engineAnswers: modelAnswers, liveSearchEvidence: [liveEvidence], liveSerpRequested: true,
    });
    expect(result.GEO.value).toBe(70);
    expect(result.GEO.engines).toEqual(ENGINE_COUNCIL_MODELS.slice(0, 7).map((engine) => engine.key));
  });

  it("leaves Google AI Overview / Answer Box visibility unmeasured when the provider does not expose citations", () => {
    const result = measureKeywordAxes({
      keyword, market: "sa", brand: "Acme", site: "https://shop.example.sa",
      engineAnswers: modelAnswers, liveSearchEvidence: [liveEvidence], liveSerpRequested: true,
    });
    expect(result.SGE.value).toBeNull();
    expect(result.SGE.reason).toBe("ai_overview_and_answer_box_not_exposed_by_provider");
    expect(result.AEO.value).toBeNull();
  });

  it("counts answers delivered by the automatic backup route in GEO", () => {
    const withFallback = modelAnswers.map((answer, i) => i === 9 ? { ...answer, provider_path: "fallback" as const } : answer);
    const result = measureKeywordAxes({
      keyword, market: "sa", brand: "Acme", site: "https://shop.example.sa",
      engineAnswers: withFallback, liveSearchEvidence: [liveEvidence], liveSerpRequested: true,
    });
    expect(result.GEO.value).toBe(70);
    expect(result.GEO.reason).toBeNull();
  });
});

import { extractSiteKeywords, isPlatformUrl } from "./site-keyword-extractor";
describe("new keyword hygiene", () => {
  it("drops image dimensions, follower counts and platform words", () => {
    const list = extractSiteKeywords({ title: "Evening dresses 3000x3000", description: "62k followers photos and videos", text: "evening dresses evening dresses evening dresses" }).map((k) => k.keyword);
    expect(list.some((k) => /3000|62k|followers|photos|videos/.test(k))).toBe(false);
    expect(list).toContain("evening dresses");
  });
  it("treats Instagram and YouTube as platforms, not competitors", () => {
    expect(isPlatformUrl("https://www.instagram.com/brand")).toBe(true);
    expect(isPlatformUrl("https://youtube.com/@x")).toBe(true);
    expect(isPlatformUrl("https://rival-couture.com")).toBe(false);
  });
});
