// MCI Tool Registry — describes existing tools so the context layer can decide
// whether fresh work is needed. Pure data; changing this never alters tool logic.

export type ToolKind = "analysis" | "research" | "execution" | "content";

export type ToolProfile = {
  key: string;
  kind: ToolKind;
  needsExternalData: boolean;
  /** How long a previous result stays reusable (hours). 0 = never reuse. */
  reuseHours: number;
  /** How long engine answers stay reusable (hours). */
  engineCacheHours: number;
  /** Fraction of the normal token charge when a result is reused (0 = free). */
  reuseChargeRatio: number;
  mciEnabled: boolean;
};

export const TOOL_REGISTRY: Record<string, ToolProfile> = {
  known: { key: "known", kind: "research", needsExternalData: true, reuseHours: 24 * 7, engineCacheHours: 24, reuseChargeRatio: 0, mciEnabled: true },
  analyze: { key: "analyze", kind: "analysis", needsExternalData: true, reuseHours: 24, engineCacheHours: 24, reuseChargeRatio: 0, mciEnabled: true },
  compare: { key: "compare", kind: "analysis", needsExternalData: true, reuseHours: 24, engineCacheHours: 24, reuseChargeRatio: 0, mciEnabled: true },
  research: { key: "research", kind: "research", needsExternalData: true, reuseHours: 12, engineCacheHours: 12, reuseChargeRatio: 0, mciEnabled: true },
  visibility: { key: "visibility", kind: "analysis", needsExternalData: true, reuseHours: 24, engineCacheHours: 24, reuseChargeRatio: 0, mciEnabled: true },
  agent: { key: "agent", kind: "execution", needsExternalData: false, reuseHours: 0, engineCacheHours: 0, reuseChargeRatio: 1, mciEnabled: true },
  suggest: { key: "suggest", kind: "content", needsExternalData: false, reuseHours: 0, engineCacheHours: 0, reuseChargeRatio: 1, mciEnabled: false },
};

export function toolProfile(key: string): ToolProfile | null {
  return TOOL_REGISTRY[key] || null;
}

/** Stable fingerprint for "same request" matching (brand + market + depth). */
export function requestFingerprint(parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => String(p || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

/** Is a result created at `createdAt` still reusable for this profile? */
export function isFresh(createdAt: string | Date, hours: number, now = Date.now()): boolean {
  if (hours <= 0) return false;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t < hours * 3600_000;
}
