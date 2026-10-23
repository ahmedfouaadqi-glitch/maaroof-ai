// Pure helpers for the live ten-model probe. No I/O — safe to unit-test.
// Rules: an engine counts as "answered" only when it returned real text;
// sources are taken ONLY from real search results (never invented).

export type ProbeStatus = "answered" | "empty" | "timeout" | "error";
export type ProbeSource = { url: string; title: string };
export type ParsedProbe = { answer: string; brands: string[]; urls: string[] };

/** Output budget for probe calls. Thinking models used up 500 before writing any answer. */
export const PROBE_MAX_TOKENS = 1500;
export const PROBE_TIMEOUT_MS = 30_000;

/** Parse a model reply. Returns null when there is no usable answer text. */
export function parseProbeContent(content: unknown): ParsedProbe | null {
  const raw = typeof content === "string" ? content.trim() : "";
  if (!raw) return null;
  let obj: any = null;
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { obj = JSON.parse(fenced); } catch {
    const m = fenced.match(/\{[\s\S]*\}/);
    if (m) { try { obj = JSON.parse(m[0]); } catch { obj = null; } }
  }
  const answer = String(obj && typeof obj === "object" ? obj.answer ?? "" : fenced).replace(/\s+/g, " ").trim().slice(0, 900);
  if (!answer) return null;
  const brands: string[] = Array.isArray(obj?.brands) ? obj.brands.map((x: any) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [];
  const fromField: string[] = Array.isArray(obj?.urls) ? obj.urls.map((x: any) => String(x)) : [];
  const fromText = answer.match(/https?:\/\/[^\s)"'<>\]]+/g) || [];
  const urls = Array.from(new Set([...fromField, ...fromText].map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)))).slice(0, 8);
  return { answer, brands, urls };
}

export function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

/**
 * Link an answer to real sources: a search result is attached when the answer
 * cites its domain/URL, or names a brand that appears in that result's title.
 * Nothing outside `searchItems` can ever be returned.
 */
export function linkSources(p: ParsedProbe, searchItems: ProbeSource[], max = 4): ProbeSource[] {
  const cited = new Set(p.urls.map(hostOf).filter(Boolean));
  const text = `${p.answer} ${p.brands.join(" ")}`.toLowerCase();
  const out: ProbeSource[] = [];
  for (const it of searchItems) {
    const h = hostOf(it.url);
    if (!h) continue;
    const brandHit = p.brands.some((b) => b.length > 2 && it.title.toLowerCase().includes(b.toLowerCase()));
    if (cited.has(h) || text.includes(h) || brandHit) {
      if (!out.some((o) => o.url === it.url)) out.push({ url: it.url, title: it.title });
    }
    if (out.length >= max) break;
  }
  return out;
}

/** Tokens to give back when only some engines answered (charge answered engines only). */
export function probeRefund(chargedTokens: number, asked: number, answered: number): number {
  const c = Math.max(0, Number(chargedTokens) || 0);
  if (asked <= 0 || c === 0) return 0;
  const a = Math.min(Math.max(0, answered), asked);
  return Math.round((c * (asked - a)) / asked);
}

/** Visibility inputs the agent may pass. Background mode is never allowed inside a task. */
export function stripAgentOnlyFields<T extends Record<string, any>>(tool: string, input: T): T {
  if (tool !== "visibility" || !input) return input;
  const { background: _b, ...rest } = input as any;
  return rest as T;
}
