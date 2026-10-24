// Prompt 22 — web asset acquisition for Knowledge Spaces.
// Split out of teaching.server.ts so the ingestion pipeline stays free of the
// Firecrawl dependency until a URL asset actually needs it.
import { fcScrape } from "@/lib/firecrawl";

/** Fetch a URL as plain text/markdown for the learning pipeline. */
export async function fetchFirecrawl(url: string, ctx: { userId?: string | null } = {}): Promise<string> {
  try {
    const res: any = await fcScrape(url, { deep: true }, { userId: ctx.userId ?? null, toolKey: "teach_space" });
    const md = res?.markdown || res?.data?.markdown || res?.content || res?.data?.content || "";
    if (md) return String(md);
  } catch {}
  try {
    const r = await fetch(url, { headers: { "User-Agent": "MaaroofLearningBot/1.0" } });
    if (!r.ok) return "";
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}
