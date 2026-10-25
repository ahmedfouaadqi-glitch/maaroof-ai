// Pure fetch-source ordering rules (no I/O). Shared by scrape/search fallback chain.
export type ScrapeSource = "linkedin_direct" | "firecrawl" | "direct_http";
export type SearchSource = "firecrawl" | "apidirect";
export const FETCH_TIMEOUT_MS = 15_000;

/** True only when a scrape exposes usable text or meaningful title+description metadata. */
export function hasUsableScrapeEvidence(result: any, url = ""): boolean {
  const data = result?.data ?? result;
  const meta = data?.metadata ?? {};
  const markdown = String(data?.markdown ?? "").trim();
  const title = String(meta.title ?? "").trim();
  const description = String(meta.description ?? "").trim();
  const status = Number(meta.statusCode);
  if (Number.isFinite(status) && status >= 400) return false;
  const combined = [title, description, markdown].join("\n");
  const blockedShell = /(challenge_required|verify (?:that )?you(?:'re| are) human|sorry, this page isn.t available|log in to instagram|sign in to instagram|instagram\.com\/accounts\/login)/i.test(combined);
  const profileMetadata = title.length >= 3 && description.length >= 20;
  // Reject provider/login placeholders, but preserve public profile OG metadata when it is substantive.
  if (blockedShell && !profileMetadata) return false;
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
    firecrawl: ["قُرئت بالقارئ العميق", "Read with deep reader", "بە خوێنەری قووڵ خوێندرایەوە"],
    direct_http: ["قُرئت مباشرة", "Read directly", "ڕاستەوخۆ خوێندرایەوە"],
    linkedin_direct: ["قُرئ الملف المهني مباشرة", "Profile read directly", "پرۆفایل ڕاستەوخۆ خوێندرایەوە"],
    apidirect: ["بحث احتياطي", "Backup search", "گەڕانی یەدەگ"],
  };
  const i = lang === "en" ? 1 : lang === "ku" ? 2 : 0;
  return s ? m[s][i] : ["لم تُقرأ الصفحة", "Page not read", "پەڕە نەخوێندرایەوە"][i];
}
