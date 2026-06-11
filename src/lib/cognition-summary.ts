// Client-safe helpers for summarizing tool input/output into compact strings
// for the cognition engine (runCognition).

function flatten(value: unknown, depth = 0, parts: string[] = []): string[] {
  if (value == null) return parts;
  if (depth > 4) return parts;
  if (typeof value === "string") {
    const s = value.trim();
    if (s) parts.push(s);
    return parts;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    parts.push(String(value));
    return parts;
  }
  if (Array.isArray(value)) {
    for (const v of value.slice(0, 20)) flatten(v, depth + 1, parts);
    return parts;
  }
  if (typeof value === "object") {
    const PREFERRED = [
      "title", "name", "label", "brand", "company", "query",
      "summary", "executive_summary", "overview", "appearance_summary",
      "answer", "sge_summary", "ai_view", "stage_assessment",
      "recommendations", "next_steps", "priority_actions", "quick_wins",
      "key_findings", "visibility_opportunities", "post_ideas",
      "score", "overall", "visibility_percent", "sentiment", "confidence",
      "verdict", "final_recommendation",
    ];
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const ordered = [
      ...PREFERRED.filter((k) => k in obj),
      ...keys.filter((k) => !PREFERRED.includes(k)),
    ].slice(0, 20);
    for (const k of ordered) flatten(obj[k], depth + 1, parts);
  }
  return parts;
}

function clamp(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function summarizeInput(obj: unknown, max = 1500): string {
  return clamp(flatten(obj).join(" · "), max);
}

export function summarizeOutput(obj: unknown, max = 3500): string {
  return clamp(flatten(obj).join(" · "), max);
}
