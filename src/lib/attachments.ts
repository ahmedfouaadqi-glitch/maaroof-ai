// Pure rules for task/interview attachments. No I/O.
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Image types the vision model can read. Other files are still accepted. */
export const ATTACHMENT_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv"] as const;

/** image/pdf → vision model; text → read as text; office → unzip XML; binary → stored, not read. */
export type AttachmentKind = "image" | "pdf" | "text" | "office" | "binary";

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|html?|css|scss|js|jsx|ts|tsx|mjs|cjs|py|rb|php|java|kt|go|rs|c|cc|cpp|h|hpp|cs|swift|sh|bash|sql|ya?ml|toml|ini|env|log|svg|srt|vtt|rtf|tex)$/i;
const OFFICE_EXT = /\.(docx|xlsx|pptx|odt|ods|odp)$/i;
const VISION_IMG = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function attachmentKind(mime: string, name = ""): AttachmentKind {
  const m = (mime || "").toLowerCase();
  if (VISION_IMG.includes(m)) return "image";
  if (m === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (OFFICE_EXT.test(name) || m.includes("officedocument") || m.includes("opendocument")) return "office";
  if (m.startsWith("text/") || m === "application/json" || m === "application/xml" || m === "image/svg+xml" || m.includes("javascript") || TEXT_EXT.test(name)) return "text";
  return "binary";
}

/** Any file type is accepted; only empty and oversized files are refused. */
export function validateAttachment(f: { size: number; type: string }): "ok" | "too_large" | "empty" {
  if (!f.size) return "empty";
  if (f.size > ATTACHMENT_MAX_BYTES) return "too_large";
  return "ok";
}

/** Strip XML tags to plain text (for unzipped office documents). */
export function xmlToText(xml: string): string {
  return xml
    .replace(/<\/(w:p|a:p|text:p|row)>/g, "\n")
    .replace(/<(w:tab|text:tab)\/>/g, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
}

/** Which entries inside an office zip carry readable text. */
export function officeTextEntry(path: string): boolean {
  return /^word\/(document|header\d*|footer\d*|footnotes)\.xml$/.test(path)
    || /^xl\/sharedStrings\.xml$/.test(path) || /^xl\/worksheets\/sheet\d+\.xml$/.test(path)
    || /^ppt\/slides\/slide\d+\.xml$/.test(path) || /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path)
    || path === "content.xml";
}

/** Storage path is always inside the owner's folder. */
export function attachmentPath(userId: string, fileName: string, stamp: number, workspaceId?: string | null): string {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return `${userId}/${stamp}-${safe}`;
  return `${userId}/${workspaceId}/${stamp}-${safe}`;
}

/** True only when the path belongs to the user's own folder (no traversal). */
export function ownsPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes("..");
}
