import { describe, it, expect } from "vitest";
import { detectMarkets } from "./market-scope";
import { factDensity, negativeCandidates, shareOfVoice, buildOperationalPayload, NA } from "./operational-workbook";

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
  it("keeps every file row and marks missing evidence as not available", () => {
    const rows = Array.from({ length: 1200 }, (_, i) => [`kw ${i}`, i]);
    const p = buildOperationalPayload({ brand: "B", lang: "en", markets: detectMarkets(["USA"]), sheets: [{ name: "USA KEYWORDS", columns: ["Keyword", "Volume"], rows, totalRows: 1200, truncated: false }], parties: [{ name: "B", role: "brand", url: null, found: "user", pageText: null }], engineAnswers: [] });
    expect(p.sections.find((s) => s.heading.includes("USA KEYWORDS"))!.table!.data.length).toBe(1200);
    expect(p.sections.find((s) => s.heading === "Competitor benchmark")!.table!.data[0][2]).toBe(NA.en);
  });
});
