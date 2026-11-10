/**
 * Builds a compact, deterministic evidence pack from outputs already produced
 * by the current run. It performs no I/O and never upgrades tool output into
 * an independently verified external fact.
 */
export type EvidencePackResult = {
  tool: string;
  ok: boolean;
  output?: unknown;
};

export type EvidencePack = {
  text: string;
  included: number;
  omitted: number;
  duplicateCount: number;
  successful: number;
  failed: number;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ":" + stable(item)).join(",") + "}";
  }
  try { return JSON.stringify(value ?? null); } catch { return String(value ?? ""); }
}

function compact(value: unknown, maxChars: number): string {
  let serialized = "";
  try { serialized = JSON.stringify(value ?? null, null, 2); }
  catch { serialized = String(value ?? ""); }
  return serialized.length > maxChars
    ? serialized.slice(0, maxChars) + "\n… [truncated; original output retained in run record]"
    : serialized;
}

/**
 * Prioritises successful outputs, keeps failures as explicit limitations,
 * removes exact duplicate tool payloads, and applies a hard character budget.
 */
export function buildExecutionEvidencePack(
  goal: string,
  results: EvidencePackResult[],
  options: { maxChars?: number; maxItems?: number; perItemChars?: number } = {},
): EvidencePack {
  const maxChars = Math.max(1200, Math.min(16000, Math.floor(options.maxChars ?? 9000)));
  const maxItems = Math.max(1, Math.min(30, Math.floor(options.maxItems ?? 12)));
  const perItemChars = Math.max(200, Math.min(3000, Math.floor(options.perItemChars ?? 1400)));
  const successful = results.filter((item) => item.ok);
  const failed = results.filter((item) => !item.ok);
  const seen = new Set<string>();
  const unique: EvidencePackResult[] = [];
  let duplicateCount = 0;

  // Keep execution order: dependencies and chronology remain legible.
  for (const item of successful) {
    const signature = item.tool + ":" + stable(item.output);
    if (seen.has(signature)) { duplicateCount++; continue; }
    seen.add(signature);
    unique.push(item);
  }

  const lines = [
    "# Execution Evidence Pack",
    "Task: " + String(goal || "").slice(0, 500),
    "Evidence semantics: these are outputs returned by tools in this run; they are not automatically independent-source verification.",
    "Successful tool outputs: " + successful.length + "; failed or skipped steps: " + failed.length + "; exact duplicate outputs removed: " + duplicateCount + ".",
    "",
  ];
  let included = 0;
  let omitted = 0;
  for (const item of unique.slice(0, maxItems)) {
    const section = "## Tool result: " + item.tool + "\nStatus: succeeded\nPayload:\n" + compact(item.output, perItemChars) + "\n";
    if (lines.join("\n").length + section.length > maxChars) { omitted++; continue; }
    lines.push(section);
    included++;
  }
  omitted += Math.max(0, unique.length - maxItems);

  if (failed.length) {
    const failureLines = failed.slice(0, 10).map((item) =>
      "- " + item.tool + ": " + compact(item.output, 220).replace(/\n/g, " "),
    );
    const section = "\n## Execution limitations\n" + failureLines.join("\n");
    if (lines.join("\n").length + section.length <= maxChars) lines.push(section);
  }
  if (omitted) lines.push("\nNote: " + omitted + " successful result(s) omitted from this prompt pack because of item/size limits. Full run outputs remain in the run record.");
  return {
    text: lines.join("\n").slice(0, maxChars),
    included,
    omitted,
    duplicateCount,
    successful: successful.length,
    failed: failed.length,
  };
}
