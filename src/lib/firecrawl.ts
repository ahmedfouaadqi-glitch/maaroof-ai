// Server-side Firecrawl helpers. Used by API routes.
// Direct API (not gateway). Reads FIRECRAWL_API_KEY from process.env.

const BASE = "https://api.firecrawl.dev/v2";

export class FirecrawlError extends Error {
  status: number;
  operation: "search" | "scrape";
  body: string;

  constructor(operation: "search" | "scrape", status: number, body: string) {
    super(`Firecrawl ${operation} failed: ${status}`);
    this.name = "FirecrawlError";
    this.status = status;
    this.operation = operation;
    this.body = body;
  }
}

export function isFirecrawlError(error: unknown): error is FirecrawlError {
  return error instanceof FirecrawlError || (
    !!error && typeof error === "object" && "status" in error && "operation" in error
  );
}

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
  if (!res.ok) throw new FirecrawlError("search", res.status, await res.text().catch(() => ""));
  return res.json();
}

export async function fcScrape(url: string, opts: { deep?: boolean } = {}) {
  const formats = opts.deep ? ["markdown", "html", "links"] : ["markdown"];
  const res = await fetch(`${BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({ url, formats, onlyMainContent: !opts.deep }),
  });
  if (!res.ok) throw new FirecrawlError("scrape", res.status, await res.text().catch(() => ""));
  return res.json();
}
