import { describe, expect, it } from "vitest";
import { normalizeAssistantMarkdown, parseAssistantMarkdown } from "./AssistantMessage";

describe("assistant markdown blocks", () => {
  it("turns headings, lists, and tables into structured blocks", () => {
    const blocks = parseAssistantMarkdown([
      "## الخلاصة",
      "",
      "1. إصلاح الصفحة",
      "2. إعادة الفحص",
      "",
      "| المحور | الحالة |",
      "| --- | --- |",
      "| GEO | غير مقاس |",
    ].join("\n"));
    expect(blocks.map((block) => block.type)).toEqual(["heading", "list", "table"]);
    const table = blocks[2];
    expect(table.type).toBe("table");
    if (table.type === "table") expect(table.rows[0]).toEqual(["GEO", "غير مقاس"]);
  });

  it("normalizes inline headings, numbered sections and field bullets from compact model output", () => {
    const compact = "المقدمة. ### --- تفاصيل البيانات المحفوظة في مساحة العمل: 1. الهوية الجغرافية والقطاع: * **الكيان:** Mengotti Couture * **القطاع:** التجارة الإلكترونية الفاخرة 2. الأصول الرقمية المسجلة: * **الموقع الإلكتروني:** https://example.com";
    const normalized = normalizeAssistantMarkdown(compact);
    expect(normalized).toContain("\n\n### تفاصيل البيانات المحفوظة في مساحة العمل:");
    expect(normalized).toContain("#### 1. الهوية الجغرافية والقطاع:");
    expect(normalized).toContain("* **الكيان:** Mengotti Couture");

    const blocks = parseAssistantMarkdown(compact);
    expect(blocks[0]).toEqual({ type: "paragraph", text: "المقدمة." });
    expect(blocks.some((block) => block.type === "heading" && block.text.includes("تفاصيل البيانات المحفوظة"))).toBe(true);
    expect(blocks.some((block) => block.type === "heading" && block.text.includes("الهوية الجغرافية والقطاع"))).toBe(true);
    expect(blocks.some((block) => block.type === "list" && block.items.some((item) => item.includes("Mengotti Couture")))).toBe(true);
    expect(blocks.some((block) => block.type === "heading" && block.text.includes("الأصول الرقمية المسجلة"))).toBe(true);
  });

  it("preserves code blocks while normalizing surrounding prose", () => {
    const fence = "```";
    const content = ["قبل ذلك. ### العنوان", "", "", fence + "md", "### Keep this literal", "* not a chat bullet", fence].join("\n");
    const normalized = normalizeAssistantMarkdown(content);
    expect(normalized).toContain([fence + "md", "### Keep this literal", "* not a chat bullet", fence].join("\n"));
  });

  it("does not treat raw HTML as a special render instruction", () => {
    const blocks = parseAssistantMarkdown("<script>alert(1)</script>");
    expect(blocks).toEqual([{ type: "paragraph", text: "<script>alert(1)</script>" }]);
  });
});
