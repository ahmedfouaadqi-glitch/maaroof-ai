// Server-only API Direct helpers (LinkedIn profiles/companies + web search). Output normalized to Firecrawl shapes.
const BASE = "https://apidirect.io/v1";

async function get(path: string, params: Record<string, string>, timeoutMs: number) {
  const key = process.env.APIDIRECT_API_KEY;
  if (!key) throw new Error("apidirect_not_configured");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { headers: { "X-API-Key": key }, signal: ctl.signal });
    if (!r.ok) throw new Error(`apidirect ${path} ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function adLinkedIn(url: string, timeoutMs: number) {
  const isCo = /linkedin\.com\/(company|school)\//i.test(url);
  const d: any = await get(isCo ? "/linkedin/company" : "/linkedin/person", { url }, timeoutMs);
  const name = d.full_name || d.name || "";
  const title = [name, d.headline].filter(Boolean).join(" — ");
  const desc = String(d.about || d.description || d.headline || "").slice(0, 300);
  const exp = Array.isArray(d.experience) ? d.experience.slice(0, 6).map((e: any) => `- ${e.title || ""} @ ${e.company || ""}`).join("\n") : "";
  const md = [`# ${name}`, d.headline, d.location, "", d.about || d.description || "", exp ? `\n## Experience\n${exp}` : ""].filter((x) => x != null).join("\n");
  if (!name && !desc) throw new Error("apidirect_empty");
  return { success: true, data: { markdown: md, metadata: { title, description: desc, sourceURL: url, statusCode: 200 } } };
}

export async function adSearch(query: string, limit: number, timeoutMs: number) {
  const d: any = await get("/web/search", { query }, timeoutMs);
  const web = (Array.isArray(d.results) ? d.results : []).slice(0, limit).map((r: any) => ({
    url: r.url, title: r.title || "", description: r.snippet || "", markdown: r.snippet || "",
  })).filter((r: any) => r.url);
  return { success: true, data: { web } };
}
