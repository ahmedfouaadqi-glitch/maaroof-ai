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

  it("recognizes a keyword signal in sheet metadata", () => {
    expect(hasKeywordWorkbookSignals(["Source data", "الكلمات المفتاحية", "Volume"])).toBe(true);
  });
});
