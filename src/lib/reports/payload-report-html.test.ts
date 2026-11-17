import { describe, it, expect } from "vitest";
import { buildPayloadReportHtml, safeHttpsUrl, safeColor } from "./payload-report-html";

describe("payload report html", () => {
  it("escapes tool values so a stored report cannot run scripts", () => {
    const html = buildPayloadReportHtml({ title: "<script>x</script>", sections: [{ kind: "text", heading: "h", text: "<img onerror=1>" }] }, {}, "en");
    expect(html).not.toContain("<script>x");
    expect(html).not.toContain("<img onerror");
  });
  it("writes 'not measured' for an empty value instead of inventing one", () => {
    const html = buildPayloadReportHtml({ title: "t", sections: [{ kind: "kv", heading: "h", rows: [["GEO", ""]] }] }, {}, "ar");
    expect(html).toContain("لم يُقَس");
  });
  it("accepts only https logos and hex colors", () => {
    expect(safeHttpsUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpsUrl("http://a.com/x.png")).toBe("");
    expect(safeColor("red;}")).toBe("#0A0A0C");
  });
});
