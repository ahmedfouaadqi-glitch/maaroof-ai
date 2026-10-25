import type { ExportSection } from "@/lib/exports";

export type ExportTranslationSegment = { id: string; text: string };
export type ExportTranslationPlan = {
  segments: ExportTranslationSegment[];
  totalChars: number;
  units: number;
  canTranslate: boolean;
  reason?: "too_many_segments" | "too_long" | "empty";
};

export const MAX_EXPORT_TRANSLATION_CHARS = 14_000;
export const MAX_EXPORT_TRANSLATION_SEGMENTS = 100;
const MAX_SEGMENT_CHARS = 2_200;
const TECHNICAL_SECTION = /machine-readable pack|حزمة قراءة الآلة|پاکێجی|schema\.org json-ld|faqpage schema|llms\.txt|معجم المصطلحات|فەرهەنگ|\bglossary\b/i;

function isProtectedText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length && lines.every((line) => /^https?:\/\/\S+$/i.test(line))) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try { JSON.parse(trimmed); return true; } catch { /* narrative, not JSON */ }
  }
  return false;
}

function splitLongText(value: string): { chunks: string[]; separators: string[] } {
  if (value.length <= MAX_SEGMENT_CHARS) return { chunks: [value], separators: [] };
  const chunks: string[] = [];
  const separators: string[] = [];
  let remaining = value;
  while (remaining.length > MAX_SEGMENT_CHARS) {
    let boundary = remaining.lastIndexOf("\n", MAX_SEGMENT_CHARS);
    if (boundary < MAX_SEGMENT_CHARS * 0.55) boundary = remaining.lastIndexOf(" ", MAX_SEGMENT_CHARS);
    if (boundary < MAX_SEGMENT_CHARS * 0.55) boundary = MAX_SEGMENT_CHARS;
    const chunk = remaining.slice(0, boundary).trimEnd();
    let next = boundary;
    while (next < remaining.length && /\s/.test(remaining[next])) next += 1;
    chunks.push(chunk);
    separators.push(remaining.slice(boundary, next) || " ");
    remaining = remaining.slice(next);
  }
  chunks.push(remaining);
  return { chunks, separators };
}

function mapText(value: string, path: string, mapSegment: (id: string, text: string) => string): string {
  if (isProtectedText(value)) return value;
  const split = splitLongText(value);
  return split.chunks.map((chunk, index) => mapSegment(path + "#" + index, chunk))
    .reduce((joined, part, index) => index === 0 ? part : joined + (split.separators[index - 1] ?? " ") + part, "");
}

function mapSectionStrings(sections: ExportSection[], mapSegment: (id: string, text: string) => string): ExportSection[] {
  return sections.map((section, sectionIndex) => {
    if (TECHNICAL_SECTION.test(section.heading || "")) return { ...section };
    const root = "s" + sectionIndex;
    const mt = (value: string | undefined, path: string) => typeof value === "string" ? mapText(value, path, mapSegment) : value;
    return {
      ...section,
      heading: mt(section.heading, root + ".heading") || section.heading,
      text: mt(section.text, root + ".text"),
      list: section.list?.map((value, index) => mt(value, root + ".list." + index) || value),
      rows: section.rows?.map(([key, value], index) => [
        mt(String(key), root + ".rows." + index + ".key") || String(key),
        typeof value === "string" ? mt(value, root + ".rows." + index + ".value") || value : value,
      ] as [string, string | number]),
      table: section.table ? {
        ...section.table,
        columns: section.table.columns.map((value, index) => mt(value, root + ".table.columns." + index) || value),
        data: section.table.data.map((row, rowIndex) => row.map((value, columnIndex) =>
          typeof value === "string" ? mt(value, root + ".table." + rowIndex + "." + columnIndex) || value : value)),
      } : undefined,
      cards: section.cards?.map((card, cardIndex) => ({
        ...card,
        title: mt(card.title, root + ".cards." + cardIndex + ".title") || card.title,
        subtitle: mt(card.subtitle, root + ".cards." + cardIndex + ".subtitle"),
        status: mt(card.status, root + ".cards." + cardIndex + ".status"),
        fields: card.fields?.map(([key, value], fieldIndex) => [
          mt(String(key), root + ".cards." + cardIndex + ".fields." + fieldIndex + ".key") || String(key),
          typeof value === "string" ? mt(value, root + ".cards." + cardIndex + ".fields." + fieldIndex + ".value") || value : value,
        ] as [string, string | number]),
        evidence: card.evidence?.map((value, evidenceIndex) => mt(value, root + ".cards." + cardIndex + ".evidence." + evidenceIndex) || value),
        notes: card.notes?.map((value, noteIndex) => mt(value, root + ".cards." + cardIndex + ".notes." + noteIndex) || value),
      })),
    };
  });
}

export function collectExportTranslationPlan(sections: ExportSection[]): ExportTranslationPlan {
  const segments: ExportTranslationSegment[] = [];
  mapSectionStrings(sections, (id, text) => {
    if (text.trim()) segments.push({ id, text });
    return text;
  });
  const totalChars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  const units = totalChars > 0 ? Math.ceil(totalChars / 3_500) : 0;
  const canTranslate = segments.length > 0
    && segments.length <= MAX_EXPORT_TRANSLATION_SEGMENTS
    && totalChars <= MAX_EXPORT_TRANSLATION_CHARS;
  return {
    segments,
    totalChars,
    units,
    canTranslate,
    ...(segments.length === 0 ? { reason: "empty" as const }
      : segments.length > MAX_EXPORT_TRANSLATION_SEGMENTS ? { reason: "too_many_segments" as const }
      : totalChars > MAX_EXPORT_TRANSLATION_CHARS ? { reason: "too_long" as const } : {}),
  };
}

export function applyExportTranslations(sections: ExportSection[], translations: Record<string, string>): ExportSection[] {
  return mapSectionStrings(sections, (id, original) => translations[id] ?? original);
}
