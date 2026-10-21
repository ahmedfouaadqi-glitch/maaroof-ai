// Pure safety rules for the delegated (read-only) browser. No I/O.

export const GRANT_DEFAULT_MINUTES = 30;
export const GRANT_MAX_MINUTES = 120;
export const GRANT_MAX_DOMAINS = 5;
export const MAX_STEPS_PER_GRANT = 30;

/** Normalizes a user-entered domain ("https://www.x.com/a" -> "x.com"); null if invalid. */
export function normalizeDomain(input: string): string | null {
  let s = String(input || "").trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  try {
    const h = new URL(s).hostname.replace(/^www\./, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || isPrivateHost(h)) return null;
    return h;
  } catch { return null; }
}

/** Blocks localhost, internal names and private/loopback IP ranges. */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return h.includes(":"); // raw IPv6 not allowed
}

/** True only when the URL is http(s) and its host is an allowed domain or a subdomain of one. */
export function isUrlAllowed(url: string, domains: string[]): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.username || u.password) return false;
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (isPrivateHost(h)) return false;
    return domains.some((d) => h === d || h.endsWith("." + d));
  } catch { return false; }
}

export type GrantState = { revoked: boolean; expires_at: string };
export function isGrantActive(g: GrantState, now = Date.now()): boolean {
  return !g.revoked && new Date(g.expires_at).getTime() > now;
}

export function clampMinutes(m: unknown): number {
  const n = Math.round(Number(m));
  if (!Number.isFinite(n) || n <= 0) return GRANT_DEFAULT_MINUTES;
  return Math.min(GRANT_MAX_MINUTES, n);
}

/** Actions that are never performed, regardless of instruction. */
const FORBIDDEN = /(password|login|sign ?in|checkout|purchase|buy|pay|submit|post|publish|delete|كلمة ?المرور|تسجيل ?الدخول|شراء|ادفع|دفع|انشر|نشر|احذف|حذف|أرسل ?النموذج)/i;
export function isForbiddenInstruction(text: string): boolean {
  return FORBIDDEN.test(String(text || ""));
}

/** Extracts absolute links from page links, keeping only allowed ones, deduped. */
export function allowedLinks(links: unknown, domains: string[], limit = 50): string[] {
  if (!Array.isArray(links)) return [];
  const out = new Set<string>();
  for (const l of links) {
    if (typeof l === "string" && isUrlAllowed(l, domains)) out.add(l.split("#")[0]);
    if (out.size >= limit) break;
  }
  return [...out];
}
