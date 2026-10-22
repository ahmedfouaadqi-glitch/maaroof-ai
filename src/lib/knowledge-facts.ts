// Pure helpers for facts Maaroof learned (from tasks, interview, profile). No I/O.

export const TASK_FACT_TTL_DAYS = 30;
export const FACT_MAX_CHARS = 600;

export type FactSource = "task" | "interview" | "profile";
export type Fact = { source: FactSource; fact: string; confidence: "evidence" | "hypothesis"; created_at: string; expires_at?: string | null; source_ref?: string | null };

/** Builds the stored fact for a completed task, or null when the task produced no usable result. */
export function taskFact(goal: string, finalText: string, now = Date.now()) {
  const g = String(goal || "").trim();
  const t = String(finalText || "").replace(/\s+/g, " ").trim();
  if (!g || t.length < 20) return null;
  return {
    fact: `${g.slice(0, 150)} — ${t}`.slice(0, FACT_MAX_CHARS),
    confidence: "evidence" as const,
    expires_at: new Date(now + TASK_FACT_TTL_DAYS * 86400000).toISOString(),
  };
}

/** Facts not yet expired. */
export function freshFacts<T extends { expires_at?: string | null }>(facts: T[], now = Date.now()): T[] {
  return facts.filter((f) => !f.expires_at || new Date(f.expires_at).getTime() > now);
}

/** Compact planner context line from fresh facts; empty string when none. */
export function factsContextLine(facts: Array<{ fact: string; source: string }>, max = 8): string {
  const list = facts.slice(0, max).map((f) => `- [${f.source}] ${f.fact.slice(0, 240)}`);
  return list.length ? `Known facts about this user from earlier work (verify before relying on them):\n${list.join("\n")}\n\n` : "";
}

/** Interview answers become facts; unanswered questions are skipped. */
export function interviewFacts(rows: Array<{ question: string; answer: string | null; answered_at?: string | null; created_at: string }>): Fact[] {
  return rows.filter((r) => r.answer && r.answer.trim()).map((r) => ({
    source: "interview", fact: `${r.question} — ${String(r.answer).trim()}`.slice(0, FACT_MAX_CHARS),
    confidence: "evidence", created_at: r.answered_at || r.created_at,
  }));
}

/** Only non-expired evidence facts may be broadcast; hypotheses never are. */
export function canBroadcast(f: { confidence: string; expires_at?: string | null }, now = Date.now()): boolean {
  return f.confidence === "evidence" && (!f.expires_at || new Date(f.expires_at).getTime() > now);
}

/** Markdown section of user-approved facts for the public brand card; empty when none qualify. */
export function broadcastSection(facts: Array<{ fact: string; confidence: string; broadcast?: boolean; expires_at?: string | null }>, now = Date.now()): string {
  const ok = facts.filter((f) => f.broadcast === true && canBroadcast(f, now)).slice(0, 20);
  return ok.length ? `\n\n## Verified facts\n${ok.map((f) => `- ${f.fact.replace(/\s+/g, " ").slice(0, 300)}`).join("\n")}\n` : "";
}

/** Distinct public http(s) hosts mentioned in a task result (for an in-task safe-browser offer). */
export function domainsInText(text: string, max = 3): string[] {
  const out = new Set<string>();
  for (const m of String(text || "").matchAll(/https?:\/\/[^\s)\]"'<>]+/g)) {
    try { out.add(new URL(m[0]).hostname.replace(/^www\./, "").toLowerCase()); } catch {}
    if (out.size >= max) break;
  }
  return [...out];
}

/** Owner identity fields Maaroof knows from the profile (no invented values). */
export const OWNER_FIELDS = ["full_name", "brand_name", "account_kind", "specialty", "hq_country", "target_markets", "entity_links"] as const;
export type OwnerField = (typeof OWNER_FIELDS)[number];

/** Which owner fields are present vs. missing, and completeness 0–100. Verified only when the entity card is verified. */
export function ownerIdentity(p: Record<string, any> | null | undefined) {
  const has = (k: OwnerField) => {
    const v = p?.[k];
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === "object") return Object.values(v).some((x) => typeof x === "string" && x.trim());
    return typeof v === "string" && v.trim().length > 0;
  };
  const known = OWNER_FIELDS.filter(has);
  const missing = OWNER_FIELDS.filter((k) => !has(k));
  return { known, missing, completeness: Math.round((known.length / OWNER_FIELDS.length) * 100), verified: !!p?.entity_verified_at };
}
