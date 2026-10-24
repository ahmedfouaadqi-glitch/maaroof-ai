// Pure rules for task/interview attachments. No I/O.
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv"] as const;

export type AttachmentKind = "image" | "pdf" | "text";

export function attachmentKind(mime: string): AttachmentKind | null {
  if (mime.startsWith("image/") && (ATTACHMENT_MIME as readonly string[]).includes(mime)) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain" || mime === "text/markdown" || mime === "text/csv") return "text";
  return null;
}

export function validateAttachment(f: { size: number; type: string }): "ok" | "too_large" | "bad_type" | "empty" {
  if (!f.size) return "empty";
  if (f.size > ATTACHMENT_MAX_BYTES) return "too_large";
  return attachmentKind(f.type) ? "ok" : "bad_type";
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
