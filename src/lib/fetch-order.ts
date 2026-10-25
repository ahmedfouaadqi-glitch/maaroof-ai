// Pure fetch-source ordering rules (no I/O). Shared by scrape/search fallback chain.
export type ScrapeSource = "linkedin_direct" | "firecrawl" | "direct_http";
export type SearchSource = "firecrawl" | "apidirect";
export const FETCH_TIMEOUT_MS = 15_000;

export type ReadIssueCode =
  | "instagram_automated_access_denied"
  | "instagram_rate_limited"
  | "target_access_restricted"
  | "target_rate_limited"
  | "reader_rate_limited"
  | "reader_quota_reached"
  | "timeout"
  | "source_unavailable"
  | "insufficient_public_content";

export class PublicReadFailure extends Error {
  readonly readIssue: ReadIssueCode;
  readonly origin: "target" | "reader" | "unknown";
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(readIssue: ReadIssueCode, origin: PublicReadFailure["origin"], status?: number, retryAfterMs?: number) {
    // Deliberately provider-neutral: this message can cross API boundaries.
    super("Could not retrieve usable public page content.");
    this.name = "PublicReadFailure";
    this.readIssue = readIssue;
    this.origin = origin;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function parseRetryAfterMs(value: string | null | undefined, now = Date.now()): number | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

export function isReadIssueCode(value: unknown): value is ReadIssueCode {
  return typeof value === "string" && [
    "instagram_automated_access_denied",
    "instagram_rate_limited",
    "target_access_restricted",
    "target_rate_limited",
    "reader_rate_limited",
    "reader_quota_reached",
    "timeout",
    "source_unavailable",
    "insufficient_public_content",
  ].includes(value);
}

export function isInstagramUrl(url: string): boolean {
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

/** Classifies only observable response evidence, never guesses from a failed request alone. */
export function classifyUnusableScrape(result: any, url: string): ReadIssueCode {
  const data = result?.data ?? result;
  const meta = data?.metadata ?? {};
  const status = Number(meta.statusCode);
  const instagram = isInstagramUrl(url);
  if (status === 429) return instagram ? "instagram_rate_limited" : "target_rate_limited";
  if (status === 401 || status === 403) return instagram ? "instagram_automated_access_denied" : "target_access_restricted";

  const content = [
    String(meta.title ?? ""),
    String(meta.description ?? ""),
    String(data?.markdown ?? ""),
  ].join("\n");
  const challenge = /(challenge_required|verify (?:that )?you(?:'re| are) human|sorry, this page isn.t available|unusual traffic)/i.test(content);
  const login = /(log in or sign up to view|sign in to view|log in to see|sign in to see|instagram\.com\/accounts\/login)/i.test(content) ||
    (/(log in to instagram|sign in to instagram)/i.test(content) && !(String(meta.title ?? "").trim().length >= 3 && String(meta.description ?? "").trim().length >= 20));
  if (challenge || login) return instagram ? "instagram_automated_access_denied" : "target_access_restricted";
  return "insufficient_public_content";
}

/** Select the most explanatory known failure after all safe fallback routes have been attempted. */
export function preferredReadFailure(failures: PublicReadFailure[]): PublicReadFailure {
  const priority: Record<ReadIssueCode, number> = {
    instagram_automated_access_denied: 100,
    instagram_rate_limited: 95,
    target_access_restricted: 90,
    target_rate_limited: 85,
    reader_quota_reached: 75,
    reader_rate_limited: 70,
    timeout: 60,
    source_unavailable: 50,
    insufficient_public_content: 10,
  };
  return [...failures].sort((a, b) => priority[b.readIssue] - priority[a.readIssue])[0] ??
    new PublicReadFailure("source_unavailable", "unknown");
}

/** True only when a scrape exposes usable text or meaningful title+description metadata. */
export function hasUsableScrapeEvidence(result: any): boolean {
  const data = result?.data ?? result;
  const meta = data?.metadata ?? {};
  const markdown = String(data?.markdown ?? "").trim();
  const title = String(meta.title ?? "").trim();
  const description = String(meta.description ?? "").trim();
  const status = Number(meta.statusCode);
  if (Number.isFinite(status) && status >= 400) return false;
  const combined = [title, description, markdown].join("\n");
  const profileMetadata = title.length >= 3 && description.length >= 20;
  const blockedChallenge = /(challenge_required|verify (?:that )?you(?:'re| are) human|sorry, this page isn.t available)/i.test(combined);
  const genericLogin = /(log in or sign up to view|sign in to view|log in to see|sign in to see|instagram\.com\/accounts\/login)/i.test([title, description].join("\n"));
  const genericLoginShell = /(log in to instagram|sign in to instagram)/i.test(combined) && !profileMetadata;
  // Reject generic login/challenge pages, while allowing real public metadata even if the page shell mentions login.
  if (blockedChallenge || genericLogin || genericLoginShell) return false;
  if (markdown.length > 40) return true;
  if (profileMetadata) return true;
  // Title-only results are not enough to claim that the entity profile was read.
  return false;
}

export function isLinkedIn(url: string): boolean {
  try { return /(^|\.)linkedin\.com$/i.test(new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname); } catch { return false; }
}

/** LinkedIn -> API Direct first, then Firecrawl. Public pages -> Firecrawl, then plain HTTP read. */
export function scrapeOrder(url: string, has: { apidirect: boolean; firecrawl: boolean }): ScrapeSource[] {
  const out: ScrapeSource[] = [];
  if (isLinkedIn(url)) {
    if (has.apidirect) out.push("linkedin_direct");
    if (has.firecrawl) out.push("firecrawl");
    return out;
  }
  if (has.firecrawl) out.push("firecrawl");
  out.push("direct_http");
  return out;
}

export function searchOrder(has: { apidirect: boolean; firecrawl: boolean }): SearchSource[] {
  const out: SearchSource[] = [];
  if (has.firecrawl) out.push("firecrawl");
  if (has.apidirect) out.push("apidirect");
  return out;
}

/** Plain-language label of where content came from (no provider names). */
export function sourceLabel(s: ScrapeSource | SearchSource | null, lang: "ar" | "en" | "ku" = "ar"): string {
  const m: Record<string, [string, string, string]> = {
    firecrawl: ["اكتملت قراءة المحتوى العام", "Public content reading completed", "خوێندنەوەی ناوەڕۆکی گشتی تەواو بوو"],
    direct_http: ["قُرئت الصفحة مباشرة", "Page read directly", "پەڕەکە ڕاستەوخۆ خوێندرایەوە"],
    linkedin_direct: ["قُرئ الملف العام مباشرة", "Public profile read directly", "پرۆفایلی گشتی ڕاستەوخۆ خوێندرایەوە"],
    apidirect: ["اُستخدم مسار بحث بديل", "An alternate search route was used", "ڕێڕەوی گەڕانی جێگرەوە بەکارهات"],
  };
  const i = lang === "en" ? 1 : lang === "ku" ? 2 : 0;
  return s ? m[s][i] : ["تعذرت قراءة الصفحة", "Page could not be read", "پەڕەکە نەخوێندرایەوە"][i];
}
