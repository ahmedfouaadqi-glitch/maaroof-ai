import { describe, expect, it } from "vitest";
import { parseAssistantMarkdown } from "./AssistantMessage";

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

  it("does not treat raw HTML as a special render instruction", () => {
    const blocks = parseAssistantMarkdown("<script>alert(1)</script>");
    expect(blocks).toEqual([{ type: "paragraph", text: "<script>alert(1)</script>" }]);
  });
});
