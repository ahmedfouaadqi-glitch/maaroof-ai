import { describe, it, expect } from "vitest";
import { detectMarkets } from "./market-scope";
import { factDensity, negativeCandidates, shareOfVoice, buildOperationalPayload, NA, enginesMentioning, keywordAxis, keywordAxisScores } from "./operational-workbook";

describe("market scope", () => {
  it("reads markets from sheet names", () => {
    expect(detectMarkets(["USA KEYWORDS", "LEBANON KEYWORDS", "AUSTRALIA KEYWORDS", "SCORING MODEL"]).map((m) => m.code)).toEqual(["us", "lb", "au"]);
  });
  it("assumes no market when none is named", () => {
    expect(detectMarkets(["MASTER KEYWORDS", "تحليل"])).toEqual([]);
  });
});

describe("operational workbook", () => {
  it("counts numeric facts", () => {
    expect(factDensity("Founded 2010 with 40% growth and 12 stores")!.facts).toBe(3);
    expect(factDensity(null)).toBeNull();
  });
  it("flags exclusion words only", () => {
    expect(negativeCandidates(["dior bag free", "dior bag price"]).map((x) => x.keyword)).toEqual(["dior bag free"]);
  });
  it("share of voice counts only answering engines", () => {
    const v = shareOfVoice([
      { market: "us", engine: "chatgpt", status: "answered", answer: "Try Mengotti", urls: [] },
      { market: "us", engine: "gemini", status: "answered", answer: "Try Farfetch", urls: [] },
      { market: "us", engine: "claude", status: "no_answer", answer: "", urls: [] },
    ], "Mengotti");
    expect(v).toEqual({ answered: 2, mentioned: 1, percent: 50 });
  });
  it("match score counts engines whose answer names the keyword", () => {
    const ans = [
      { market: "us", engine: "chatgpt", status: "answered" as const, answer: "Buy a dior bag at X", urls: [] },
      { market: "us", engine: "gemini", status: "answered" as const, answer: "Try Farfetch", urls: [] },
    ];
    expect(enginesMentioning(ans, "us", "Dior Bag")).toEqual(["chatgpt"]);
  });
  it("does not call an unasked keyword zero visibility, and distinguishes a measured zero mention", () => {
    const p = buildOperationalPayload({
      brand: "B",
      lang: "en",
      markets: detectMarkets(["USA"]),
      sheets: [{
        name: "USA KEYWORDS",
        columns: ["Keyword"],
        rows: [["designer dress"], ["evening gown"]],
        totalRows: 2,
        truncated: false,
      }],
      parties: [{ name: "B", role: "brand", url: null, found: "user", pageText: null }],
      engineAnswers: [{
        market: "us",
        engine: "chatgpt",
        status: "answered",
        answer: "Try boutiques",
        urls: [],
        query: 'In United States: "designer dress"',
      }],
    });
    const rows = p.sections.find((s) => s.heading === "Keywords per engine")!.table!.data;
    const asked = rows.find((r) => r[0] === "designer dress")!;
    const unasked = rows.find((r) => r[0] === "evening gown")!;
    expect(asked[2]).toBe("0/1");
    expect(asked[3]).toBe("No literal mention in direct answers");
    expect(unasked[2]).toBe("Not measured directly");
    expect(unasked[3]).toBe("Not tested in engine query");
  });

  it("classifies question keywords and recommendation keywords", () => {
    expect(keywordAxis("how to clean a dior bag").axis).toBe("AEO");
    expect(keywordAxis("best luxury bags").axis).toBe("GEO");
  });

  it("keeps client export free of internal fallback diagnostics", () => {
    const p = buildOperationalPayload({ brand: "B", lang: "en", markets: detectMarkets(["USA"]), sheets: [{ name: "USA KEYWORDS", columns: ["Keyword"], rows: [["luxury eyewear"]], totalRows: 1, truncated: false }], parties: [{ name: "B", role: "brand", url: null, found: "user", pageText: null }], engineAnswers: [{ market: "us", engine: "chatgpt", status: "answered", answer: "B is a retailer", urls: [], provider_path: "fallback" }] });
    expect(p.sections).toHaveLength(6);
    expect(JSON.stringify(p.sections)).not.toMatch(/Fallback route|Execution and errors|Execution route|المسار البديل|التنفيذ والأخطاء/i);
  });

  it("exposes all six heuristic axes without presenting them as measured visibility", () => {
    const scores = keywordAxisScores("AI answer citations and sources");
    expect(Object.keys(scores).sort()).toEqual(["AEO", "GEO", "GSEO", "SEO", "SGE", "SGEO"].sort());
    expect(scores.SGEO).toBeGreaterThan(scores.SEO);
    expect(keywordAxis("technical SEO audit").axis).toBe("GSEO");
    expect(keywordAxis("Google AI overview").axis).toBe("SGE");
  });

  it("includes more than 30 keywords per market in the operational output", () => {
    const keywords = Array.from({ length: 42 }, (_, i) => ["designer dress " + i]);
    const p = buildOperationalPayload({
      brand: "B",
      lang: "en",
      markets: detectMarkets(["USA"]),
      sheets: [{ name: "USA KEYWORDS", columns: ["Keyword"], rows: keywords, totalRows: keywords.length, truncated: false }],
      parties: [{ name: "B", role: "brand", url: null, found: "user", pageText: null }],
      engineAnswers: [],
    });
    const perEngine = p.sections.find((s) => s.heading === "Keywords per engine")!;
    expect(perEngine.table!.data).toHaveLength(42);
    expect(perEngine.table!.columns).toContain("Six-axis heuristic scores (not measured)");
  });
});
