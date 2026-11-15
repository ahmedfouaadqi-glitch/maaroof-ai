import { describe, expect, it } from "vitest";
import { buildVisibilityWorkbook } from "./visibility-workbook";

describe("visibility workbook terminology sheet", () => {
  it("exports classification, maturity, measurement, limitations and references", () => {
    const sheets = buildVisibilityWorkbook("Example", {}, "en");
    const glossary = sheets.find((sheet) => sheet.name === "Terminology glossary");
    expect(glossary).toBeDefined();
    expect(glossary!.rows[0]).toHaveLength(8);
    const geo = glossary!.rows.find((row) => row[0] === "GEO");
    expect(geo).toBeDefined();
    expect(geo).toHaveLength(8);
    expect(String(geo![3])).toBe("research_field");
    expect(String(geo![7])).toContain("arxiv.org/abs/2311.09735");
  });
});
