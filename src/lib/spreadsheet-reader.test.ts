import { describe, it, expect } from "vitest";
import { parseXlsxEntries, parseCsv, detectColumns, workbookDigest, googleSheetId, colIndex, buildStructure } from "./spreadsheet-reader";

const files = {
  "xl/workbook.xml": `<workbook><sheets><sheet name="MASTER KEYWORDS" sheetId="1" r:id="rId1"/><sheet name="Negative &amp; Brand" sheetId="2" r:id="rId2"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
  "xl/sharedStrings.xml": `<sst><si><t>Keyword</t></si><si><t>Search Volume</t></si><si><r><t>wedding </t></r><r><t>dress</t></r></si><si><t>free</t></si></sst>`,
  "xl/worksheets/sheet1.xml": `<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1900</v></c></row></sheetData>`,
  "xl/worksheets/sheet2.xml": `<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Keyword</t></is></c></row><row r="2"><c r="A2" t="s"><v>3</v></c></row></sheetData>`,
};

describe("spreadsheet reader", () => {
  it("keeps every sheet name in workbook order with resolved shared strings", () => {
    const s = parseXlsxEntries(files);
    expect(s.map((x) => x.name)).toEqual(["MASTER KEYWORDS", "Negative & Brand"]);
    expect(s[0].columns).toEqual(["Keyword", "Search Volume"]);
    expect(s[0].rows[0]).toEqual(["wedding dress", 1900]);
    expect(s[1].rows[0]).toEqual(["free"]);
  });
  it("reports true row count and truncation beyond the row cap", () => {
    const rows = Array.from({ length: 12 }, (_, i) => `<row><c r="A${i + 1}"><v>${i}</v></c></row>`).join("");
    const s = parseXlsxEntries({ "xl/worksheets/sheet1.xml": `<sheetData>${rows}</sheetData>` }, 5)[0];
    expect(s.totalRows).toBe(11);
    expect(s.rows.length).toBe(5);
    expect(s.truncated).toBe(true);
  });
  it("column letters map to indexes", () => { expect(colIndex("AA3")).toBe(26); });
  it("parses CSV with quoted commas", () => {
    const s = parseCsv('Keyword,CPC\n"dress, red",1.5\n');
    expect(s.rows[0]).toEqual(["dress, red", 1.5]);
  });
  it("detects column roles from headers only", () => {
    expect(detectColumns(["Keyword", "Avg. monthly searches", "Top of page bid", "Intent"])).toEqual({ keyword: "Keyword", volume: "Avg. monthly searches", cpc: "Top of page bid", intent: "Intent" });
  });
  it("digest lists all sheets even when rows are cut", () => {
    const d = workbookDigest(parseXlsxEntries(files), 2000);
    expect(d).toContain('"MASTER KEYWORDS"');
    expect(d).toContain('"Negative & Brand"');
    expect(buildStructure(parseXlsxEntries(files), "xlsx").totalRows).toBe(2);
  });
  it("extracts Google Sheets id", () => {
    expect(googleSheetId("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0")).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms");
  });
});
