import { describe, expect, it } from "vitest";
import {
  buildExportExecutiveSummary,
  buildExportJsonDocument,
  payloadToCSV,
  payloadToMarkdown,
  splitTextForSlides,
  type ExportPayload,
} from "./exports";

const payload: ExportPayload = {
  title: 'Visibility "Quarterly"',
  subtitle: "Evidence-based visibility review",
  lang: "en",
  sections: [
    { heading: "Overview", kind: "text", text: "The public page needs clearer service details." },
    {
      heading: "SEO/GEO dimensions",
      kind: "cards",
      cards: [
        { title: "SEO readiness", score: 72, status: "Measured", fields: [["Indexed pages", 12]], evidence: ["https://example.com/audit"], notes: ["Recheck after updates."] },
        { title: "AI answer presence", score: null, status: "Not measured", fields: [["Probe state", "Skipped"]] },
      ],
    },
    { heading: "Sample table", kind: "table", table: { columns: ["Name", "Value"], data: [["A|B", "1,2"]] } },
    { heading: "Configuration", kind: "kv", rows: [["Formula-like text", "=1+1"]] },
  ],
};

describe("format-specific export templates", () => {
  it("builds an executive summary from recorded values without averaging unlike scores", () => {
    const summary = buildExportExecutiveSummary(payload);
    expect(summary.heading).toBe("Executive summary");
    expect(summary.metrics.map((metric) => metric.value)).toEqual([4, 1, 1, 1]);
    expect(summary.measuredItems).toEqual([
      { section: "SEO/GEO dimensions", title: "SEO readiness", score: 72, status: "Measured" },
    ]);
    expect(summary.unmeasuredItems[0]).toEqual({
      section: "SEO/GEO dimensions",
      title: "AI answer presence",
      status: "Not measured",
    });
    expect(summary.note).toContain("does not average");
  });

  it("exports a normalized CSV schema for cards, tables and key-value rows", () => {
    const csv = payloadToCSV(payload, "2026-10-26T12:00:00.000Z");
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("record_type,section,item,metric,value,score,status,evidence,notes");
    expect(csv).toContain("card_metric,SEO/GEO dimensions,SEO readiness,Indexed pages,12,72,Measured");
    expect(csv).toContain("table_row,Sample table,1,,");
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("2026-10-26T12:00:00.000Z");
  });

  it("adds Markdown front matter and a summary while escaping table separators", () => {
    const markdown = payloadToMarkdown(payload, "2026-10-26T12:00:00.000Z");
    expect(markdown).toContain("schema_version: 2");
    expect(markdown).toContain('title: "Visibility \\"Quarterly\\""');
    expect(markdown).toContain("## Executive summary");
    expect(markdown).toContain("A\\|B");
    expect(markdown).toContain("72/100");
  });

  it("adds a versioned summary to JSON while preserving raw report sections", () => {
    const document = buildExportJsonDocument(payload, "2026-10-26T12:00:00.000Z");
    expect(document.schema_version).toBe(2);
    expect(document.generated_at).toBe("2026-10-26T12:00:00.000Z");
    expect(document.executive_summary.metrics.map((metric) => metric.value)).toEqual([4, 1, 1, 1]);
    expect(document.sections).toEqual(payload.sections);
  });

  it("splits long PowerPoint text without losing characters or exceeding the requested size", () => {
    const source = Array.from({ length: 800 }, (_, index) => "item" + index).join(" ");
    const chunks = splitTextForSlides(source, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 500)).toBe(true);
    expect(chunks.join("")).toBe(source);
  });
});
