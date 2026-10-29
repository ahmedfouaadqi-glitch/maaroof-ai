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
  it("produces eight sections with axes in the approved order", () => {
    const s = buildKeywordIntelligenceSections({ ...base, hasFile: false });
    expect(s).toHaveLength(8);
    expect(s[4].table!.columns.slice(2, 8)).toEqual(["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"]);
    expect(s[4].table!.columns).toContain("Unmeasured reason");
    expect([...AXES_ORDER]).toEqual(["SEO", "AEO", "GEO", "SGE", "GSEO", "SGEO"]);
  });
  it("drops the old-vs-new column without a file and keeps it with one", () => {
    expect(buildKeywordIntelligenceSections({ ...base, hasFile: false })[0].table!.columns).not.toContain("Old vs new");
    const sheets = [{ name: "KW", columns: ["Keyword"], rows: [["luxury sunglasses"]], totalRows: 1, truncated: false }];
    expect(buildKeywordIntelligenceSections({ ...base, sheets, hasFile: true })[0].table!.columns).toContain("Old vs new");
  });
  it("reads unmeasured share of voice as not measured", () => {
    const row = buildKeywordIntelligenceSections({ ...base, hasFile: false })[0].table!.data[0];
    expect(row[3]).toBe("Not measured");
  });
  it("sorts negatives into four groups", () => {
    const groups = new Set(buildKeywordIntelligenceSections({ ...base, hasFile: false })[6].table!.data.map((r) => r[0]));
    expect([...groups]).toEqual(["Brand", "Competitors", "Comparison", "Social"]);
  });
  it("extracts only words that appear on the page", () => {
    const k = extractSiteKeywords({ text: brand.pageText, title: brand.title }).map((x) => x.keyword);
    expect(k).toContain("luxury sunglasses");
    for (const w of k) expect(brand.pageText.toLowerCase() + " " + brand.title.toLowerCase()).toContain(w);
  });
});
