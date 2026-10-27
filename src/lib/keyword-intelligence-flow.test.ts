import { describe, expect, it } from "vitest";
import { hasKeywordWorkbookSignals, shouldAutoStartKeywordResearch } from "./keyword-intelligence-flow";

describe("keyword intelligence auto-start", () => {
  const keywordWorkbook = ["Keywords by market", "Keyword", "Volume", "United States"];

  it("starts for an explicit Arabic keyword analysis and Excel output request", () => {
    expect(shouldAutoStartKeywordResearch("حلل الكلمات المفتاحية وانتج ملف Excel", keywordWorkbook)).toBe(true);
  });

  it("starts for an explicit English SEO workbook analysis and export request", () => {
    expect(shouldAutoStartKeywordResearch("Analyze this SEO spreadsheet and export an Excel workbook", ["Keyword", "Search volume"])).toBe(true);
  });

  it("does not start on a general greeting or summary-only request", () => {
    expect(shouldAutoStartKeywordResearch("لخص الملف", keywordWorkbook)).toBe(false);
    expect(shouldAutoStartKeywordResearch("Hello", keywordWorkbook)).toBe(false);
  });

  it("does not start without an explicit workbook output request", () => {
    expect(shouldAutoStartKeywordResearch("Analyze the keywords and explain the findings", keywordWorkbook)).toBe(false);
  });

  it("can recognize keyword intent from the request even if headers are ambiguous", () => {
    expect(shouldAutoStartKeywordResearch("Analyze my SEO and export to xlsx", ["Data", "Term"])).toBe(true);
  });

  it("does not auto-start for a non-keyword workbook", () => {
    expect(shouldAutoStartKeywordResearch("Analyze this Excel workbook and export a report", ["Employee", "Salary", "Department"])).toBe(false);
  });

  it("keeps the workbook deliverable when external evidence is absent or partial", async () => {
    const { deriveEvidenceState, hasChargeableMarketEvidence } = await import("./keyword-intelligence-flow");
    expect(deriveEvidenceState({
      answeredMarketCalls: 0, answeredClusterCalls: 0, readablePages: 0,
      socialResults: 0, structuredEvidence: 0, failedProbes: 10,
    })).toBe("none");
    expect(deriveEvidenceState({
      answeredMarketCalls: 1, answeredClusterCalls: 0, readablePages: 0,
      socialResults: 0, structuredEvidence: 0, failedProbes: 9,
    })).toBe("partial");
    expect(deriveEvidenceState({
      answeredMarketCalls: 10, answeredClusterCalls: 5, readablePages: 3,
      socialResults: 4, structuredEvidence: 2, failedProbes: 0,
    })).toBe("available");
    expect(hasChargeableMarketEvidence(0, false)).toBe(false);
    expect(hasChargeableMarketEvidence(1, false)).toBe(true);
    expect(hasChargeableMarketEvidence(0, true)).toBe(true);
  });

  it("recognizes a keyword signal in sheet metadata", () => {
    expect(hasKeywordWorkbookSignals(["Source data", "الكلمات المفتاحية", "Volume"])).toBe(true);
  });
});
