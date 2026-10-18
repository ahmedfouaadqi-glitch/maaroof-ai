/** Extract a concise human-readable summary from heterogeneous tool response shapes. */
const SUMMARY_KEYS = [
  "summary", "executive_summary", "short_summary", "answer", "final_answer",
  "text", "message", "recommendation", "strategy", "comparison", "conclusion",
  "winner", "overview", "result", "data", "report", "analysis", "sections",
  "highlights", "findings",
] as const;

export function extractToolSummary(value: unknown, maxLength = 500, depth = 0): string | null {
  if (depth > 4 || value == null) return null;
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .slice(0, 4)
      .map((item) => extractToolSummary(item, maxLength, depth + 1))
      .filter((item): item is string => !!item);
    return parts.length ? parts.join(" — ").slice(0, maxLength) : null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of SUMMARY_KEYS) {
    if (!(key in record)) continue;
    const summary = extractToolSummary(record[key], maxLength, depth + 1);
    if (summary) return summary;
  }
  return null;
}
