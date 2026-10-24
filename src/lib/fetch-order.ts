// Pure fetch-source ordering rules (no I/O). Shared by scrape/search fallback chain.
export type ScrapeSource = "linkedin_direct" | "firecrawl" | "direct_http";
export type SearchSource = "firecrawl" | "apidirect";
export const FETCH_TIMEOUT_MS = 15_000;

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
