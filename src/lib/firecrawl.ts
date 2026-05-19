// Server-side Firecrawl helpers. Used by API routes.
// Direct API (not gateway). Reads FIRECRAWL_API_KEY from process.env.

const BASE = "https://api.firecrawl.dev/v2";

function getKey(): string {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY is not configured");
  return k;
}

export async function fcSearch(query: string, opts: { limit?: number; lang?: string } = {}) {
  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      query,
      limit: opts.limit ?? 6,
      lang: opts.lang,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl search failed: ${res.status}`);
  return res.json();
}

export async function fcScrape(url: string, opts: { deep?: boolean } = {}) {
  const formats = opts.deep ? ["markdown", "html", "links"] : ["markdown"];
  const res = await fetch(`${BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({ url, formats, onlyMainContent: !opts.deep }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape failed: ${res.status}`);
  return res.json();
}
