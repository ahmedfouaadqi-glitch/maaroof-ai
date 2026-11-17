import { describe, expect, it } from "vitest";
import { sanitizeWorksheetName } from "./export-worksheet-name";

describe("sanitizeWorksheetName", () => {
  it("replaces Excel-forbidden characters", () => {
    expect(sanitizeWorksheetName("SEO/ GEO: A*B? [C]")).toBe("SEO_ GEO_ A_B_ _C_");
  });

  it("limits worksheet names to 31 characters", () => {
    expect(sanitizeWorksheetName("a".repeat(50))).toHaveLength(31);
  });

  it("removes leading and trailing apostrophes", () => {
    expect(sanitizeWorksheetName("'Audit Report'")).toBe("Audit Report");
  });

  it("uses a safe fallback for an empty name", () => {
    expect(sanitizeWorksheetName("///", "Sheet 1")).toBe("___");
    expect(sanitizeWorksheetName("", "Sheet 1")).toBe("Sheet 1");
  });
});
