export type VisibilityPlatform = {
  name: string;
  score: number;
  citation_likelihood: "high" | "medium" | "low";
  citation_method: string;
  evidence_basis: string;
  authority_factors: string[];
  trust_signal: string;
  freshness_weight: "high" | "medium" | "low";
  why: string;
  action: string;
  priority: "high" | "medium" | "low";
};

const PLATFORM_NAMES = [
  "ChatGPT",
  "Gemini",
  "Claude",
  "Perplexity",
  "Copilot",
  "Grok",
  "Mistral",
  "DeepSeek",
  "Kimi",
] as const;

function clamp(n: unknown): number {
  const value = typeof n === "number" ? n : Number(String(n ?? ""));
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)));
}

function toArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, 220));
}

export function normalizePlatforms(value: unknown): VisibilityPlatform[] {
  const arr = Array.isArray(value) ? value : [];
  const byName = new Map<string, Record<string, unknown>>();
  for (const item of arr) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const name = String((item as Record<string, unknown>).name || "").trim();
      if (name && (PLATFORM_NAMES as readonly string[]).includes(name)) {
        byName.set(name, item as Record<string, unknown>);
      }
    }
  }

  const enumOrDefault = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    fallback: T,
  ): T =>
    typeof value === "string" && allowed.includes(value as T)
      ? (value as T)
      : fallback;

  return PLATFORM_NAMES.map((name) => {
    const platform = byName.get(name) || {};
    const factors = Array.isArray(platform.authority_factors)
      ? platform.authority_factors
          .slice(0, 4)
          .map((item) => String(item ?? "").slice(0, 90))
          .filter(Boolean)
      : [];
    return {
      name,
      score: clamp(platform.score),
      citation_likelihood: enumOrDefault(
        platform.citation_likelihood,
        ["high", "medium", "low"] as const,
        "low",
      ),
      citation_method: String(platform.citation_method || "")
        .trim()
        .slice(0, 100),
      evidence_basis: String(platform.evidence_basis || "")
        .trim()
        .slice(0, 240),
      authority_factors: factors,
      trust_signal: String(platform.trust_signal || "")
        .trim()
        .slice(0, 120),
      freshness_weight: enumOrDefault(
        platform.freshness_weight,
        ["high", "medium", "low"] as const,
        "medium",
      ),
      why: String(platform.why || "")
        .trim()
        .slice(0, 360),
      action: String(platform.action || "")
        .trim()
        .slice(0, 220),
      priority: enumOrDefault(
        platform.priority,
        ["high", "medium", "low"] as const,
        "medium",
      ),
    };
  });
}

export function normalizeResult(parsed: unknown, fallbackText = "") {
  const source =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const sentiment = ["positive", "neutral", "negative"].includes(
    String(source.sentiment),
  )
    ? (source.sentiment as "positive" | "neutral" | "negative")
    : "neutral";
  const platforms = normalizePlatforms(source.platforms);
  // All supported engines have equal weight. Derive the headline from the normalized
  // platform values so the headline can never contradict the platform breakdown.
  const visibilityPercent = Math.round(
    platforms.reduce((sum, platform) => sum + platform.score, 0) /
      platforms.length,
  );
  const confidence = ["high", "medium", "low"].includes(
    String(source.confidence),
  )
    ? (source.confidence as "high" | "medium" | "low")
    : "medium";

  return {
    visibility_percent: visibilityPercent,
    confidence,
    sentiment,
    appearance_summary: String(
      source.appearance_summary || fallbackText || "",
    )
      .trim()
      .slice(0, 500),
    strengths: toArray(source.strengths, 6),
    weaknesses: toArray(source.weaknesses, 6),
    competitors: toArray(source.competitors, 6),
    recommendations: toArray(source.recommendations, 8),
    platforms,
  };
}
