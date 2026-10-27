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
  it("preserves source rows, deduplicates keywords, and labels negative candidates for review", () => {
    const rows = [["dior bag", 10], ["Dior Bag", 10], ["dior bag free", 5]];
    const sourceSheets = [
      { name: "USA KEYWORDS", columns: ["Keyword", "Volume"], rows, totalRows: 3, truncated: false },
      { name: "NEGATIVE KEYWORDS", columns: ["Keyword"], rows: [["free"], ["Free"]], totalRows: 2, truncated: false },
    ];
    const p = buildOperationalPayload({
      brand: "B",
      lang: "en",
      markets: detectMarkets(["USA"]),
      sheets: sourceSheets,
      parties: [{ name: "B", role: "brand", url: null, found: "user", pageText: null }],
      engineAnswers: [],
    });
    expect(p.sections.length).toBeGreaterThan(6);
    const originals = p.sections.find((s) => s.heading === "Original data — USA KEYWORDS");
    expect(originals?.table?.data).toEqual(rows);
    const keywordSection = p.sections.find((s) => s.heading === "Keywords by market");
    expect(keywordSection?.table?.data.length).toBe(2);
    const neg = p.sections.find((s) => s.heading === "Negative keywords — review required")!.table!.data;
    const normalized = neg.map((r) => String(r[0]).toLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
    expect(neg.some((r) => String(r[1]).toLowerCase().includes("candidate") && String(r[2]).toLowerCase().includes("review"))).toBe(true);
    expect(p.sections.find((s) => s.heading === "Brand vs competitors")!.table!.data[0][4]).toBe(NA.en);
  });

  it("exports exact engine queries, answer statuses, and recorded cluster responses", () => {
    const p = buildOperationalPayload({
      brand: "B",
      lang: "en",
      markets: detectMarkets(["USA"]),
      sheets: [{ name: "USA KEYWORDS", columns: ["Keyword"], rows: [["designer dress"]], totalRows: 1, truncated: false }],
      parties: [{ name: "B", role: "brand", url: null, found: "user", pageText: null }],
      engineAnswers: [{ market: "us", engine: "chatgpt", status: "answered", answer: "Try boutiques", urls: ["https://example.org"], query: "Actual query with designer dress" }],
      clusterAnswers: [{ market: "us", engine: "chatgpt", keywords: ["designer dress"], status: "answered", answer: "Try boutiques" }],
    });
    const engines = p.sections.find((s) => s.heading === "Ten-engine answer and status log")!;
    expect(engines.table!.data[0]).toContain("Actual query with designer dress");
    expect(engines.table!.data[0]).toContain("answered");
    const clusters = p.sections.find((s) => s.heading === "Keyword-cluster probe results")!;
    expect(clusters.table!.data[0]).toContain("designer dress");
    expect(clusters.table!.data[0]).toContain("Try boutiques");
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

  it("reports distinct provider failures in the execution summary", () => {
    const p = buildOperationalPayload({
      brand: "B",
      lang: "en",
      markets: detectMarkets(["USA"]),
      sheets: [{ name: "USA KEYWORDS", columns: ["Keyword"], rows: [["designer dress"]], totalRows: 1, truncated: false }],
      parties: [{ name: "B", role: "brand", url: null, found: "user", pageText: null }],
      engineAnswers: [
        { market: "us", engine: "chatgpt", status: "answered", answer: "Try boutiques", urls: [], query: '"designer dress"' },
        { market: "us", engine: "gemini", status: "no_answer", answer: "", urls: [], query: '"designer dress"', error: "Provider API key is not configured" },
        { market: "us", engine: "claude", status: "empty", answer: "", urls: [], query: '"designer dress"', error: "Provider returned no message content" },
        { market: "us", engine: "qwen", status: "timeout", answer: "", urls: [], query: '"designer dress"', error: "Request timed out" },
        { market: "us", engine: "mistral", status: "http_error", answer: "", urls: [], query: '"designer dress"', error: "HTTP 429" },
        { market: "us", engine: "deepseek", status: "error", answer: "", urls: [], query: '"designer dress"', error: "Network failure" },
      ],
      clusterAnswers: [
        { market: "us", engine: "chatgpt", status: "answered", answer: "Try boutiques", keywords: ["designer dress"] },
        { market: "us", engine: "qwen", status: "timeout", answer: "", keywords: ["designer dress"], error: "Request timed out" },
      ],
      alexandria: { connected: false, note: "unreachable" },
    });
    const execution = p.sections.find((s) => s.heading === "Execution and errors")!.table!.data;
    const marketProbes = execution.find((row) => row[0] === "Market engine probes")!;
    expect(marketProbes.slice(1, 8)).toEqual([6, 1, 0, 1, 1, 1, 1]);
    const clusters = execution.find((row) => row[0] === "Keyword cluster probes")!;
    expect(clusters.slice(1, 8)).toEqual([2, 1, 0, 0, 0, 1, 0]);
    const engineLog = p.sections.find((s) => s.heading === "Ten-engine answer and status log")!.table!.data;
    expect(engineLog.some((row) => row.includes("HTTP 429") && row.includes("http_error"))).toBe(true);
    const alexRow = execution.find((row) => row[0] === "Optional Alexandria source")!;
    expect(alexRow.slice(1, 4)).toEqual([1, 0, 0]);
  });

  it.skip("(obsolete: fallback answers now count) share of voice", () => {
    const answers = [
      { market: "us", engine: "chatgpt", status: "answered" as const, answer: "Mengotti Couture is a retailer", urls: [], provider_path: "primary" as const },
      { market: "us", engine: "gemini", status: "answered" as const, answer: "Mengotti Couture is a retailer", urls: [], provider_path: "fallback" as const },
      { market: "us", engine: "claude", status: "answered" as const, answer: "Other retailer", urls: [], provider_path: "primary" as const },
    ];
    expect(shareOfVoice(answers, "Mengotti Couture")).toEqual({ answered: 2, mentioned: 1, percent: 50 });
    expect(enginesMentioning(answers, "us", "Mengotti Couture")).toEqual(["chatgpt"]);

    const payload = buildOperationalPayload({
      brand: "Mengotti Couture",
      lang: "en",
      markets: detectMarkets(["USA"]),
      sheets: [{ name: "USA KEYWORDS", columns: ["Keyword"], rows: [["luxury eyewear"]], totalRows: 1, truncated: false }],
      parties: [{ name: "Mengotti Couture", role: "brand", url: null, found: "user", pageText: null }],
      engineAnswers: answers,
      clusterAnswers: [
        { market: "us", engine: "chatgpt", status: "answered" as const, answer: "Mengotti Couture is a retailer", keywords: ["luxury eyewear"], provider_path: "primary" as const },
        { market: "us", engine: "gemini", status: "answered" as const, answer: "Mengotti Couture is a retailer", keywords: ["luxury eyewear"], provider_path: "fallback" as const },
      ],
    });
    const log = payload.sections.find((section) => section.heading === "Ten-engine answer and status log")!.table!.data;
    expect(log.some((row) => row.includes("Fallback route"))).toBe(true);
    const execution = payload.sections.find((section) => section.heading === "Execution and errors")!.table!.data;
    const marketProbes = execution.find((row) => row[0] === "Market engine probes")!;
    expect(marketProbes.slice(1, 5)).toEqual([3, 2, 1, 0]);
    const clusterProbes = execution.find((row) => row[0] === "Keyword cluster probes")!;
    expect(clusterProbes.slice(1, 5)).toEqual([2, 1, 1, 0]);
  });

  it("classifies question keywords and recommendation keywords", () => {
    expect(keywordAxis("how to clean a dior bag").axis).toBe("AEO");
    expect(keywordAxis("best luxury bags").axis).toBe("GEO");
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
