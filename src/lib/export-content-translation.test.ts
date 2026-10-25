import { describe, expect, it } from "vitest";
import { applyExportTranslations, collectExportTranslationPlan } from "./export-content-translation";
import type { ExportSection } from "./exports";

describe("export content translation plan", () => {
  it("collects narrative strings and excludes machine-readable code and URL-only values", () => {
    const sections: ExportSection[] = [
      { heading: "Findings", kind: "text", text: "The site has incomplete service details." },
      { heading: "Sources", kind: "list", list: ["https://example.com/page", "The official page lists the service."] },
      { heading: "Machine-readable pack — llms.txt — Code", kind: "text", text: "# Sample\n## Facts" },
      { heading: "Schema.org JSON-LD (Organization)", kind: "text", text: "{\"@type\":\"Organization\"}" },
    ];
    const plan = collectExportTranslationPlan(sections);
    expect(plan.segments.map((segment) => segment.text)).toContain("The site has incomplete service details.");
    expect(plan.segments.map((segment) => segment.text)).toContain("The official page lists the service.");
    expect(plan.segments.some((segment) => segment.text.startsWith("https://"))).toBe(false);
    expect(plan.segments.some((segment) => segment.text.includes("@type"))).toBe(false);
    expect(plan.segments.some((segment) => segment.text === "# Sample")).toBe(false);
  });

  it("applies translated text by path while preserving URL-only entries", () => {
    const sections: ExportSection[] = [
      { heading: "Summary", kind: "text", text: "The brand was mentioned 3 of 10 times.", list: ["https://example.com", "Next step: update service details."] },
    ];
    const plan = collectExportTranslationPlan(sections);
    const translations = Object.fromEntries(plan.segments.map((segment) => [segment.id, "ترجمة: " + segment.text]));
    const output = applyExportTranslations(sections, translations);
    expect(output[0].heading).toBe("ترجمة: Summary");
    expect(output[0].text).toBe("ترجمة: The brand was mentioned 3 of 10 times.");
    expect(output[0].list?.[0]).toBe("https://example.com");
    expect(output[0].list?.[1]).toBe("ترجمة: Next step: update service details.");
  });

  it("splits long text into bounded chunks and estimates translation units", () => {
    const longText = Array.from({ length: 900 }, (_, index) => "word" + index).join(" ");
    const plan = collectExportTranslationPlan([{ heading: "Long report", kind: "text", text: longText }]);
    expect(plan.segments.length).toBeGreaterThan(1);
    expect(plan.segments.every((segment) => segment.text.length <= 2200)).toBe(true);
    expect(plan.units).toBe(Math.ceil(plan.totalChars / 3500));
    expect(plan.canTranslate).toBe(true);
  });
});
