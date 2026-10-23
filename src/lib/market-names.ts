// Pure rules for entity names per market (no I/O).
import { normalizeName } from "@/lib/maaroof/mkd";

export type MarketStatus = "evidence_confirmed" | "owner_confirmed" | "unconfirmed";
export type MarketName = { country_code: string; name: string; lang: string; status?: string; evidence_url?: string | null };

/** Best status for one market: evidence beats owner confirmation; nothing else is "confirmed". */
export function marketStatus(rows: MarketName[], country: string, evidenceCountries: string[] = []): MarketStatus {
  const c = country.toUpperCase();
  if (evidenceCountries.map((x) => x.toUpperCase()).includes(c)) return "evidence_confirmed";
  const mine = rows.filter((r) => r.country_code.toUpperCase() === c);
  if (mine.some((r) => r.status === "evidence_confirmed")) return "evidence_confirmed";
  if (mine.some((r) => r.status === "owner_confirmed")) return "owner_confirmed";
  return "unconfirmed";
}

/** Markets where the same-language name differs from the brand's name in other markets. */
export function nameConsistency(rows: MarketName[]): { lang: string; variants: string[] }[] {
  const byLang = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const n = normalizeName(r.name);
    if (!n) continue;
    const m = byLang.get(r.lang) ?? new Map<string, string>();
    if (!m.has(n)) m.set(n, r.name.trim());
    byLang.set(r.lang, m);
  }
  return [...byLang.entries()].filter(([, m]) => m.size > 1).map(([lang, m]) => ({ lang, variants: [...m.values()] }));
}

/** No job event within this window means the job never really started. */
export const JOB_START_MS = 45_000;
export function startStale(job: { status: string; created_at: string }, eventCount: number, now = Date.now()): boolean {
  if (job.status !== "running" || eventCount > 0) return false;
  const t = new Date(job.created_at).getTime();
  return Number.isFinite(t) && now - t > JOB_START_MS;
}
