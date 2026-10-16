// Silent knowledge layer: short verified facts about a brand/market fed to model prompts.
// Server-only; provider names never reach users. Always fails open ("" on any error).
import { fcSearch } from "./firecrawl";

export async function enrichFacts(brand: string, market: string, ctx: { userId?: string | null; toolKey?: string | null } = {}, max = 4): Promise<string> {
  try {
    if (!brand || brand.length < 2 || !process.env.FIRECRAWL_API_KEY) return "";
    const q = `${brand}${market ? ` ${market}` : ""}`;
    const sr: any = await fcSearch(q, { limit: max }, ctx);
    const items: any[] = sr?.data?.web || sr?.web || (Array.isArray(sr?.data) ? sr.data : []);
    return formatFacts(items, max);
  } catch {
    return "";
  }
}

/** Pure: turn search items into compact fact lines (exported for tests). */
export function formatFacts(items: any[], max = 4): string {
  if (!Array.isArray(items)) return "";
  return items.slice(0, max).map((it) => {
    const title = String(it?.title || "").slice(0, 120);
    const snip = String(it?.description || it?.snippet || it?.markdown || "").replace(/\s+/g, " ").slice(0, 240);
    const url = String(it?.url || "");
    return title || snip ? `- ${title}${snip ? `: ${snip}` : ""}${url ? ` (${url})` : ""}` : "";
  }).filter(Boolean).join("\n");
}
