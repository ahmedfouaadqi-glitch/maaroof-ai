// MKD — pure helpers (no I/O) so they can be unit-tested.
// Normalization, dedupe, false-positive filter and the truth rule:
// AI-only observations can never be "verified".

export const MKD_CATEGORIES = [
  "direct", "indirect", "substitute", "hidden", "emerging", "perceived", "seasonal",
] as const;
export type MkdCategory = (typeof MKD_CATEGORIES)[number];

export type Candidate = {
  name: string;
  domain?: string | null;
  sources: string[]; // urls
  fromWeb: boolean;
  fromAi: boolean;
};

const STOP = new Set(["inc", "llc", "ltd", "co", "company", "group", "corp", "شركه", "مجموعه"]);
const AR_DIACRITICS = /[\u064B-\u0652\u0640]/g;

export function normalizeName(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

export function normalizeDomain(u?: string | null): string | null {
  if (!u) return null;
  try {
    const h = new URL(u.startsWith("http") ? u : `https://${u}`).hostname.toLowerCase();
    return h.replace(/^www\./, "") || null;
  } catch { return null; }
}

/** Root label of a domain, e.g. "shop.foo.com.iq" -> "foo". */
export function domainRoot(d: string | null): string | null {
  if (!d) return null;
  const parts = d.split(".").filter(Boolean);
  const tlds = new Set(["com", "net", "org", "co", "iq", "sa", "ae", "io", "ai", "uk", "eg", "gov", "edu"]);
  while (parts.length > 1 && tlds.has(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] || null;
}

/** Merge candidates referring to the same entity (same domain or same normalized name). */
export function dedupeCandidates(list: Candidate[], max = 25): Candidate[] {
  const out: Candidate[] = [];
  for (const c of list) {
    const n = normalizeName(c.name);
    if (!n) continue;
    const d = normalizeDomain(c.domain);
    const hit = out.find((o) => {
      const od = normalizeDomain(o.domain);
      if (d && od && d === od) return true;
      const on = normalizeName(o.name);
      if (on === n) return true;
      const r = domainRoot(d), orr = domainRoot(od);
      return !!(r && orr && r === orr && r.length > 3);
    });
    if (hit) {
      hit.sources = Array.from(new Set([...hit.sources, ...c.sources]));
      hit.fromWeb ||= c.fromWeb;
      hit.fromAi ||= c.fromAi;
      if (!hit.domain && c.domain) hit.domain = c.domain;
    } else {
      out.push({ ...c, domain: d, sources: [...new Set(c.sources)] });
    }
  }
  return out.slice(0, max);
}

const PLATFORM_DOMAINS = [
  "google", "facebook", "instagram", "youtube", "wikipedia", "linkedin", "twitter", "x", "tiktok",
  "amazon", "yelp", "tripadvisor", "trustpilot", "reddit", "quora", "medium", "yellowpages",
  "crunchbase", "glassdoor", "indeed", "apple", "play", "maps", "pinterest", "telegram", "whatsapp",
];

export type FpReason = "self" | "platform" | "directory" | "too_short";

/** Returns a reason if the candidate is a likely false positive, else null. */
export function falsePositiveReason(c: Candidate, brand: string, brandDomain?: string | null): FpReason | null {
  const n = normalizeName(c.name);
  if (n.length < 2) return "too_short";
  const bn = normalizeName(brand);
  const d = normalizeDomain(c.domain);
  const bd = normalizeDomain(brandDomain);
  if (n === bn || (d && bd && d === bd)) return "self";
  const root = domainRoot(d);
  if (root && PLATFORM_DOMAINS.includes(root)) return "platform";
  const words = n.split(" ");
  if (PLATFORM_DOMAINS.includes(n) || words.some((w) => PLATFORM_DOMAINS.includes(w) && w.length > 2 && words.length <= 3)) return "platform";
  if (/(^| )(top|best|list|directory|apps|platforms|دليل|افضل|تطبيقات|منصات|مواقع)( |$)/.test(n)) return "directory";
  return null;
}

export type RelationDraft = {
  category: string;
  confidence: number;
  fromWeb: boolean;
  fromAi: boolean;
  sourceCount: number;
};

/** Truth rule: never "verified" in this phase; AI-only stays "inferred" and flagged. */
export function relationTruth(r: RelationDraft) {
  const category = (MKD_CATEGORIES as readonly string[]).includes(r.category) ? r.category : "indirect";
  const aiOnly = r.fromAi && !r.fromWeb;
  let conf = Math.max(0, Math.min(100, Math.round(Number(r.confidence) || 0)));
  // Evidence-bound ceiling: fewer independent sources → lower ceiling.
  const ceiling = aiOnly ? 45 : Math.min(90, 40 + r.sourceCount * 12);
  conf = Math.min(conf, ceiling);
  return {
    category,
    confidence: conf,
    is_ai_observation: aiOnly || category === "perceived",
    verification_state: aiOnly ? "inferred" : "observed",
  };
}

/** Count how many AI engines named each candidate (by normalized name/root match). */
export function namesMatch(a: string, b: string): boolean {
  const m = normalizeName(a), n = normalizeName(b);
  if (!m || !n) return false;
  if (m === n) return true;
  if (m.length > 3 && n.length > 3 && (m.includes(n) || n.includes(m))) return true;
  const ta = m.split(" ").filter(Boolean), tb = n.split(" ").filter(Boolean);
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return short.length > 0 && short.every((w) => long.has(w));
}

export function engineMentions(name: string, byEngine: Record<string, string[]>): string[] {
  if (!normalizeName(name)) return [];
  return Object.entries(byEngine)
    .filter(([, list]) => list.some((x) => namesMatch(x, name)))
    .map(([e]) => e);
}

export type EvidenceDraft = { title: string; claim: string; sourceRef: string };

/** Map discovered relations to evidence drafts (one per source, capped). Pure + testable. */
export function mkdEvidenceDrafts(
  brand: string,
  relations: { entity_name: string; reason?: string; sources?: string[] }[],
  maxPerEntity = 3,
): EvidenceDraft[] {
  const out: EvidenceDraft[] = [];
  for (const r of relations || []) {
    for (const url of (r.sources || []).slice(0, maxPerEntity)) {
      if (!url) continue;
      out.push({
        title: `${r.entity_name} — competitor of ${brand}`,
        claim: String(r.reason || `${r.entity_name} competes with ${brand}`).slice(0, 600),
        sourceRef: url,
      });
    }
  }
  return out;
}

/** Build localized discovery queries anchored to the chosen market. */
export function localQueries(brand: string, sector: string, place: string, lang: string, deep: boolean): string[] {
  const q: string[] = [];
  const s = sector.trim();
  if (place) {
    q.push(`${brand} competitors ${place}`, `alternatives to ${brand} ${place}`);
    if (s) q.push(`best ${s} ${place}`);
    if (lang !== "en") {
      q.push(`منافسو ${brand} في ${place}`, `بدائل ${brand} في ${place}`);
      if (s) q.push(`أفضل ${s} في ${place}`);
    }
    if (deep) q.push(s ? `${s} companies ${place}` : `companies like ${brand} ${place}`, `شركات منافسة لـ ${brand} ${place}`);
  } else {
    q.push(`${brand} competitors`, `${brand} alternatives`);
    if (s) q.push(`best ${s} companies`);
    if (deep) q.push(`${brand} vs`, `منافسو ${brand}`);
  }
  return Array.from(new Set(q));
}
