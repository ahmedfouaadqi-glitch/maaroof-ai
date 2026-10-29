import { describe, it, expect } from "vitest";
import { buildKeywordIntelligenceSections, AXES_ORDER } from "./keyword-intelligence";
import { INGESTION_WINDOWS, ingestionFor } from "./keyword-ingestion-timeline";
import { extractSiteKeywords } from "./site-keyword-extractor";

const brand = { name: "Acme", role: "brand" as const, url: "https://acme.example", found: "user" as const, pageText: "luxury sunglasses luxury sunglasses handmade frames handmade frames free sunglasses free sunglasses", title: "Luxury sunglasses", description: null };
const comp = { name: "Rival", role: "competitor" as const, url: "https://rival.example", found: "user" as const, pageText: "designer eyewear designer eyewear luxury sunglasses luxury sunglasses", title: null, description: null };
const base = { brand: "Acme", lang: "en" as const, markets: [], sheets: [], parties: [brand, comp], engineAnswers: [] };

describe("keyword intelligence", () => {
  it("uses 20 days and 3 months for new keywords", () => {
    expect(INGESTION_WINDOWS).toEqual({ initialDays: 20, fullMonths: 3 });
    expect(ingestionFor(true, "ar").initial).toContain("20");
    expect(ingestionFor(true, "ar").full).toContain("3 أشهر");
  });
  it("produces six consolidated sheets with axes in the approved order", () => {
    const s = buildKeywordIntelligenceSections({ ...base, hasFile: false });
    expect(s).toHaveLength(6);
    expect(s[3].table!.columns.slice(2, 8)).toEqual(["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"]);
    expect(s[3].table!.columns).toContain("Unmeasured reason");
    expect([...AXES_ORDER]).toEqual(["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"]);
  });
  it("drops the old-vs-new column without a file and keeps it with one", () => {
    expect(buildKeywordIntelligenceSections({ ...base, hasFile: false })[1].table!.columns).not.toContain("Old vs new");
    const sheets = [{ name: "KW", columns: ["Keyword"], rows: [["luxury sunglasses"]], totalRows: 1, truncated: false }];
    expect(buildKeywordIntelligenceSections({ ...base, sheets, hasFile: true })[1].table!.columns).toContain("Old vs new");
  });
  it("reads unmeasured share of voice as not measured", () => {
    const row = buildKeywordIntelligenceSections({ ...base, hasFile: false })[1].table!.data[0];
    expect(row[3]).toBe("Not measured");
  });
  it("measures share of voice from literal brand mentions, not just keyword repetition", () => {
    const engineAnswers = [
      { market: "unknown", engine: "chatgpt", status: "answered" as const, answer: "Luxury sunglasses are a popular category.", urls: [], query: 'Search phrase: "luxury sunglasses"' },
      { market: "unknown", engine: "claude", status: "answered" as const, answer: "Acme is recommended for luxury sunglasses.", urls: [], query: 'Search phrase: "luxury sunglasses"' },
    ];
    const row = buildKeywordIntelligenceSections({ ...base, engineAnswers, hasFile: false })[1].table!.data.find((item) => item[0] === "luxury sunglasses");
    expect(row?.[3]).toBe("1/2");
    expect(row?.[7]).toBe("claude");
  });

  it("shows competitor-derived keyword opportunities with the competitor URL", () => {
    const rows = buildKeywordIntelligenceSections({ ...base, hasFile: false })[1].table!.data;
    const row = rows.find((item) => item[0] === "designer eyewear");
    expect(row).toBeDefined();
    expect(String(row?.[2])).toContain("https://rival.example");
    expect(String(row?.[9])).toContain("designer eyewear");
  });

  it("marks a keyword outside the selected market sample as unmeasured for that market", () => {
    const markets = [
      { code: "sa", en: "Saudi Arabia", ar: "السعودية", gl: "sa" },
      { code: "lb", en: "Lebanon", ar: "لبنان", gl: "lb" },
    ];
    const section = buildKeywordIntelligenceSections({
      ...base,
      markets,
      hasFile: false,
      sampledMarketKeywords: [{ market: "sa", keyword: "luxury sunglasses" }],
      liveSerpRequested: true,
      liveSearchEvidence: [{
        keyword: "luxury sunglasses", market: "sa", query: "luxury sunglasses Saudi Arabia",
        status: "measured", results: [{ url: "https://acme.example/products/sunglasses", title: "Luxury sunglasses" }],
        answerBoxChecked: false, answerBoxCitations: [], aiOverviewChecked: false, aiOverviewCitations: [],
      }],
    })[3].table!;
    const sa = section.data.find((row) => row[0] === "luxury sunglasses" && row[1] === "Saudi Arabia");
    const lb = section.data.find((row) => row[0] === "luxury sunglasses" && row[1] === "Lebanon");
    expect(String(sa?.[8])).not.toContain("Outside the sample");
    expect(String(lb?.[8])).toContain("Outside the sample");
    expect(String(lb?.[9])).toContain("not measured");
  });

  it("sorts negatives into four groups", () => {
    const groups = new Set(buildKeywordIntelligenceSections({ ...base, hasFile: false })[4].table!.data.map((r) => r[0]));
    expect([...groups]).toEqual(["Brand", "Competitors", "Comparison", "Social"]);
  });
  it("extracts only words that appear on the page", () => {
    const k = extractSiteKeywords({ text: brand.pageText, title: brand.title }).map((x) => x.keyword);
    expect(k).toContain("luxury sunglasses");
    for (const w of k) expect(brand.pageText.toLowerCase() + " " + brand.title.toLowerCase()).toContain(w);
  });
});
