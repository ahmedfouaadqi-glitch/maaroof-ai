// Pure: extracts the keywords a page actually uses (title, description, body).
// Used when no keyword file is attached. Only words found on the page are returned.
import type { SheetData } from "./spreadsheet-reader";

export type SiteKeyword = { keyword: string; count: number; source: "title" | "description" | "body" };

const STOP = new Set((
  "the and for with from that this your you our are was were has have had not but all any can will into about more most other some such than then them they their there these those what when where which who why how its it's also just only over very each per out off one two use using get new home page menu login sign cart shop more contact privacy policy terms cookies copyright rights reserved " +
  "في من على إلى الى عن مع هذا هذه ذلك تلك التي الذي الذين هو هي هم نحن انت أنت كل أو او ثم لا لم لن ما ماذا كيف هل قد كان كانت يكون تكون بين عند حتى بعد قبل أيضا ايضا جدا فقط غير لدى لكل لكن إن ان أن اذا إذا الرئيسية تسجيل الدخول اتصل سياسة الخصوصية جميع الحقوق محفوظة"
).split(/\s+/));

const tokens = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []).filter((w) => !/^\d+$/.test(w));
const NOISE = new Set("followers following follower posts photos videos video photo likes views reels stories subscribers instagram facebook tiktok youtube twitter linkedin pinterest snapchat whatsapp http https www com html php jpg jpeg png webp gif svg mp4 px rgb utf javascript cookie cookies".split(" "));
// Technical junk: dimensions (3000x3000), counts (62k), mixed digit tokens, file names.
const isNoise = (w: string) => NOISE.has(w) || /\d/.test(w) || /^[a-z]{1,2}$/.test(w);
const good = (w: string) => w.length >= 3 && !STOP.has(w) && !isNoise(w);

const PLATFORMS = ["instagram.com", "facebook.com", "youtube.com", "youtu.be", "tiktok.com", "x.com", "twitter.com", "linkedin.com", "pinterest.com", "snapchat.com", "wikipedia.org", "amazon.com", "reddit.com", "threads.net"];
/** True when the URL belongs to a public social/publishing platform rather than a brand's own site. */
export function isPlatformUrl(url?: string | null): boolean {
  try { const h = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ""); return PLATFORMS.some((p) => h === p || h.endsWith("." + p)); } catch { return false; }
}

function grams(text: string, n: number): string[] {
  const t = tokens(text); const out: string[] = [];
  for (let i = 0; i + n <= t.length; i++) {
    const g = t.slice(i, i + n);
    if (!good(g[0]) || !good(g[n - 1]) || g.some(isNoise)) continue;
    out.push(g.join(" "));
  }
  return out;
}

/** Phrases (1–3 words) ranked by frequency; title/description phrases rank first. */
export function extractSiteKeywords(input: { text?: string | null; title?: string | null; description?: string | null }, max = 60): SiteKeyword[] {
  const map = new Map<string, SiteKeyword>();
  const add = (k: string, source: SiteKeyword["source"]) => {
    const cur = map.get(k);
    if (cur) { cur.count++; if (source !== "body" && cur.source === "body") cur.source = source; }
    else map.set(k, { keyword: k, count: 1, source });
  };
  for (const [src, val] of [["title", input.title], ["description", input.description], ["body", input.text]] as const) {
    if (!val) continue;
    for (const n of [1, 2, 3]) for (const g of grams(val, n)) add(g, src);
  }
  const rank = (k: SiteKeyword) => (k.source === "body" ? 0 : 5) + k.count + (k.keyword.includes(" ") ? 1 : 0);
  return [...map.values()]
    .filter((k) => k.source !== "body" || k.count >= (k.keyword.includes(" ") ? 2 : 3))
    .sort((a, b) => rank(b) - rank(a) || a.keyword.localeCompare(b.keyword))
    .slice(0, max);
}

/** Wraps extracted keywords as a sheet so the existing workbook pipeline can read them. */
export function siteKeywordSheet(list: SiteKeyword[], name = "Site keywords"): SheetData {
  return { name, columns: ["Keyword", "Occurrences", "Source"], rows: list.map((k) => [k.keyword, k.count, k.source]), totalRows: list.length, truncated: false };
}
