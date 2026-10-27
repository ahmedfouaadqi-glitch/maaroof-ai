// Pure spreadsheet reader: XLSX (from unzipped entries) and CSV → structured workbook. No I/O.
export type Cell = string | number;
export type SheetData = { name: string; columns: string[]; rows: Cell[][]; totalRows: number; truncated: boolean };
export type ColumnRole = "keyword" | "volume" | "cpc" | "difficulty" | "intent" | "competition" | "url";
export type SheetSummary = { name: string; totalRows: number; columns: string[]; roles: Partial<Record<ColumnRole, string>>; numeric: Record<string, { min: number; max: number; sum: number; count: number }>; sample: Cell[][] };
export type WorkbookStructure = { source: "xlsx" | "csv" | "gsheet"; sheets: SheetSummary[]; totalRows: number };

export const MAX_ROWS_PER_SHEET = 5000;

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? decode(m[1]) : ""; };
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

/** Column letters → zero-based index (A=0, AA=26). */
export function colIndex(ref: string): number {
  const letters = (ref.match(/^[A-Z]+/i)?.[0] || "A").toUpperCase();
  let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
}

export function parseSheetXml(xml: string, shared: string[], maxRows = MAX_ROWS_PER_SHEET): { rows: Cell[][]; totalRows: number } {
  const rows: Cell[][] = []; let total = 0;
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Cell[] = []; let any = false;
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = cm[1]; const inner = cm[2] || "";
      const idx = colIndex(attr(tag, "r") || "A"); const t = attr(tag, "t");
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val: Cell = "";
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = textOf(inner);
      else if (t === "str" || t === "e") val = decode(v || "");
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      else if (v != null && v !== "") { const n = Number(v); val = Number.isFinite(n) ? n : decode(v); }
      if (val !== "") any = true;
      row[idx] = val;
    }
    if (!any) continue;
    total++;
    if (rows.length < maxRows) rows.push(Array.from(row, (c) => c ?? ""));
  }
  return { rows, totalRows: total };
}

/** Workbook entries (path → xml text) → named sheets in workbook order. */
export function parseXlsxEntries(files: Record<string, string>, maxRows = MAX_ROWS_PER_SHEET): SheetData[] {
  const shared = files["xl/sharedStrings.xml"] ? parseSharedStrings(files["xl/sharedStrings.xml"]) : [];
  const rels: Record<string, string> = {};
  for (const m of (files["xl/_rels/workbook.xml.rels"] || "").matchAll(/<Relationship\b[^>]*>/g)) {
    const target = attr(m[0], "Target").replace(/^\/?xl\//, "").replace(/^\//, "");
    rels[attr(m[0], "Id")] = "xl/" + target;
  }
  const declared = [...(files["xl/workbook.xml"] || "").matchAll(/<sheet\b[^>]*>/g)].map((m, i) => ({
    name: attr(m[0], "name") || `Sheet${i + 1}`,
    path: rels[attr(m[0], "r:id")] || `xl/worksheets/sheet${i + 1}.xml`,
  }));
  const list = declared.length ? declared : Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort().map((path, i) => ({ name: `Sheet${i + 1}`, path }));
  return list.filter((s) => files[s.path] != null).map((s) => toSheet(s.name, parseSheetXml(files[s.path], shared, maxRows + 1), maxRows));
}

function toSheet(name: string, parsed: { rows: Cell[][]; totalRows: number }, maxRows: number): SheetData {
  const [head = [], ...body] = parsed.rows;
  const width = Math.max(head.length, ...body.slice(0, 50).map((r) => r.length), 0);
  const columns = Array.from({ length: width }, (_, i) => String(head[i] ?? "").trim() || `Column ${i + 1}`);
  const rows = body.slice(0, maxRows);
  const totalRows = Math.max(0, parsed.totalRows - 1);
  return { name, columns, rows, totalRows, truncated: totalRows > rows.length };
}

/** RFC-4180-ish CSV (quotes, commas, newlines in quotes). Also accepts tab/semicolon. */
export function parseCsv(text: string, name = "Sheet1", maxRows = MAX_ROWS_PER_SHEET): SheetData {
  const src = text.replace(/^\uFEFF/, "");
  const first = src.split("\n", 1)[0] || "";
  const sep = (first.match(/\t/g)?.length || 0) > (first.match(/,/g)?.length || 0) ? "\t" : (first.match(/;/g)?.length || 0) > (first.match(/,/g)?.length || 0) ? ";" : ",";
  const rows: Cell[][] = []; let row: Cell[] = []; let cur = ""; let q = false; let total = 0;
  const push = () => { const n = Number(cur); row.push(cur !== "" && Number.isFinite(n) && /^-?[\d.]+$/.test(cur.trim()) ? n : cur); cur = ""; };
  const end = () => { push(); if (row.some((c) => c !== "")) { total++; if (rows.length <= maxRows) rows.push(row); } row = []; };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) push();
    else if (ch === "\n") end();
    else if (ch !== "\r") cur += ch;
  }
  if (cur !== "" || row.length) end();
  return toSheet(name, { rows, totalRows: total }, maxRows);
}

const ROLE_RX: Array<[ColumnRole, RegExp]> = [
  ["keyword", /keyword|search term|query|كلمة|الكلمات|عبارة|وشە/i],
  ["volume", /volume|searches|impressions|حجم|عدد البحث|مرات البحث/i],
  ["cpc", /\bcpc\b|cost per click|bid|تكلفة النقرة|المزايدة/i],
  ["difficulty", /difficulty|\bkd\b|صعوبة/i],
  ["intent", /intent|نية|النية/i],
  ["competition", /competition|منافسة/i],
  ["url", /\burl\b|landing|رابط|صفحة الهبوط/i],
];

/** Column roles from header names only — never guessed from values. */
export function detectColumns(columns: string[]): Partial<Record<ColumnRole, string>> {
  const out: Partial<Record<ColumnRole, string>> = {};
  for (const [role, rx] of ROLE_RX) { const c = columns.find((col) => rx.test(col) && !Object.values(out).includes(col)); if (c) out[role] = c; }
  return out;
}

export function summarizeSheet(s: SheetData, sampleRows = 5): SheetSummary {
  const numeric: SheetSummary["numeric"] = {};
  s.columns.forEach((col, i) => {
    const nums = s.rows.map((r) => r[i]).filter((v): v is number => typeof v === "number");
    if (nums.length && nums.length >= s.rows.length * 0.5) numeric[col] = { min: Math.min(...nums), max: Math.max(...nums), sum: Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100, count: nums.length };
  });
  return { name: s.name, totalRows: s.totalRows, columns: s.columns, roles: detectColumns(s.columns), numeric, sample: s.rows.slice(0, sampleRows) };
}

export function buildStructure(sheets: SheetData[], source: WorkbookStructure["source"]): WorkbookStructure {
  return { source, sheets: sheets.map((s) => summarizeSheet(s)), totalRows: sheets.reduce((a, s) => a + s.totalRows, 0) };
}

const cellStr = (c: Cell) => String(c ?? "").replace(/\s+/g, " ").replace(/\|/g, "/").slice(0, 80);

/** Text the model reads: every sheet's inventory + rows until the char budget, split fairly across sheets. */
export function workbookDigest(sheets: SheetData[], budget = 60000): string {
  if (!sheets.length) return "";
  const head = `WORKBOOK: ${sheets.length} sheets, ${sheets.reduce((a, s) => a + s.totalRows, 0)} data rows total.\n` +
    sheets.map((s, i) => `${i + 1}. "${s.name}" — ${s.totalRows} rows; columns: ${s.columns.join(", ")}`).join("\n");
  const per = Math.max(800, Math.floor((budget - head.length) / sheets.length));
  const parts = sheets.map((s) => {
    let out = `\n\n### SHEET "${s.name}" (${s.totalRows} rows)\n| ${s.columns.map(cellStr).join(" | ")} |`;
    let shown = 0;
    for (const r of s.rows) { const line = `\n| ${s.columns.map((_, i) => cellStr(r[i] ?? "")).join(" | ")} |`; if (out.length + line.length > per) break; out += line; shown++; }
    if (shown < s.totalRows) out += `\n[showing ${shown} of ${s.totalRows} rows; remaining rows were not read into this context]`;
    return out;
  });
  return (head + parts.join("")).slice(0, budget);
}

/** Google Sheets URL → spreadsheet id, else null. */
export function googleSheetId(text: string): string | null {
  return text.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] || null;
}

export function isSpreadsheetName(name: string, mime = ""): "xlsx" | "csv" | null {
  if (/\.(xlsx|xlsm)$/i.test(name) || mime.includes("spreadsheetml")) return "xlsx";
  if (/\.(csv|tsv)$/i.test(name) || mime === "text/csv") return "csv";
  return null;
}
