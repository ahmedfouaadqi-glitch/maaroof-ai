/**
 * Pure extraction of official-site facts from a scraped home page.
 * verified = seen on the official site; inferred = derived from page text; unverified = given but not found.
 */
export type DiscoveryStatus = "verified" | "inferred" | "unverified";
export type DiscoveryItem = { kind: "social" | "category"; value: string; platform?: string; status: DiscoveryStatus };

const PLATFORMS: [string, RegExp][] = [
  ["instagram", /instagram\.com/i], ["facebook", /facebook\.com|fb\.com/i], ["x", /(^|\.)twitter\.com|(^|\/\/)(www\.)?x\.com/i],
  ["linkedin", /linkedin\.com/i], ["tiktok", /tiktok\.com/i], ["youtube", /youtube\.com|youtu\.be/i],
  ["snapchat", /snapchat\.com/i], ["pinterest", /pinterest\.com/i], ["threads", /threads\.net/i],
];
const SHARE = /\/(sharer|share|intent|dialog)\b|[?&](u|url)=/i;

export function platformOf(url: string): string | null {
  for (const [k, re] of PLATFORMS) if (re.test(url)) return k;
  return null;
}

export function discoverFromSite(input: { links: string[]; markdown?: string; title?: string; description?: string; knownSocials?: string[] }): DiscoveryItem[] {
  const out: DiscoveryItem[] = [];
  const seen = new Set<string>();
  for (const raw of input.links || []) {
    const url = String(raw || "").trim().replace(/\/+$/, "");
    const p = platformOf(url);
    if (!p || SHARE.test(url) || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    out.push({ kind: "social", value: url, platform: p, status: "verified" });
  }
  for (const raw of input.knownSocials || []) {
    const url = String(raw || "").trim().replace(/\/+$/, "");
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    out.push({ kind: "social", value: url, platform: platformOf(url) || undefined, status: "unverified" });
  }
  // Categories: only headings literally present on the page (inferred = taken from page text, not confirmed by owner).
  const heads = new Set<string>();
  for (const line of String(input.markdown || "").split("\n")) {
    const m = line.match(/^#{2,3}\s+(.{2,60})$/);
    if (m) heads.add(m[1].replace(/[*_`[\]]/g, "").trim());
    if (heads.size >= 8) break;
  }
  for (const h of heads) if (h) out.push({ kind: "category", value: h, status: "inferred" });
  return out;
}
