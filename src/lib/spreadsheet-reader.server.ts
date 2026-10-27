// Spreadsheet I/O helpers: unzip XLSX bytes, fetch a public Google Sheet. Server-only.
import { parseXlsxEntries, parseCsv, type SheetData } from "./spreadsheet-reader";

export async function readXlsxBytes(buf: ArrayBuffer | Uint8Array): Promise<SheetData[]> {
  const { unzipSync } = await import("fflate");
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const raw = unzipSync(bytes, { filter: (f) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(f.name) });
  const dec = new TextDecoder();
  const files: Record<string, string> = {};
  for (const k of Object.keys(raw)) files[k] = dec.decode(raw[k]);
  return parseXlsxEntries(files);
}

export async function readSpreadsheetBytes(buf: ArrayBuffer, kind: "xlsx" | "csv", name: string): Promise<SheetData[]> {
  if (kind === "xlsx") return readXlsxBytes(buf);
  return [parseCsv(new TextDecoder().decode(buf), name.replace(/\.[^.]+$/, "") || "Sheet1")];
}

/** Reads a Google Sheet shared as "anyone with the link". Returns an error code otherwise. */
export async function fetchPublicGoogleSheet(id: string): Promise<{ sheets: SheetData[] } | { error: "not_public" | "too_large" | "unreadable" }> {
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || ct.includes("text/html")) return { error: "not_public" };
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 15 * 1024 * 1024) return { error: "too_large" };
    const sheets = await readXlsxBytes(buf);
    return sheets.length ? { sheets } : { error: "unreadable" };
  } catch { return { error: "unreadable" }; }
}
