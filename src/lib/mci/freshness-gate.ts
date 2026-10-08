// Evidence-first freshness gate. Pure.
import type { FreshnessClass } from "./types";

export const FRESHNESS_TTL_HOURS: Record<FreshnessClass, number> = {
  live: 24, competitive: 24 * 7, structural: 24 * 45,
};

const NOW_RE = /(\bnow\b|\btoday\b|\blatest\b|\bbreaking\b|الآن|اليوم|حاليا|حالياً|آخر|ئێستا|ئەمڕۆ)/i;

export function requiresLiveData(query: string): boolean {
  return NOW_RE.test(String(query || ""));
}

export function freshnessTtlHours(cls: FreshnessClass, query = ""): number {
  return requiresLiveData(query) ? 0 : FRESHNESS_TTL_HOURS[cls];
}

export function passesFreshness(createdAt: string | Date, cls: FreshnessClass, query = "", now = Date.now()): boolean {
  const ttl = freshnessTtlHours(cls, query);
  if (ttl <= 0) return false;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t < ttl * 3600_000;
}
