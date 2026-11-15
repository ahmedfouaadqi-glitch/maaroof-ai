/**
 * Pure URL intake and evidence extraction for external website audits.
 * No network, database, model or billing side effects live in this module.
 */
export type SiteDiscoveryEvidence = {
  title?: string | null;
  description?: string | null;
  markdown?: string | null;
  html?: string | null;
  statusCode?: number | null;
  source?: string | null;
};

export type DiscoveredSite = {
  url: string;
  hostname: string;
  display_name: string;
  brand_name: string | null;
  brand_name_status: "verified_from_structured_data" | "derived_from_page_title" | "domain_fallback";
  sector: string | null;
  sector_status: "evidence_inferred" | "not_established";
  site_type: "ecommerce" | "publisher" | "service_business" | "software" | "unknown";
  country: string | null;
  country_status: "explicit_site_evidence" | "country_code_domain" | "not_established";
  confidence: "high" | "medium" | "low";
  evidence: Array<{ field: string; source: string; excerpt: string }>;
  source: string | null;
  status_code: number | null;
};

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const [a, b] = parts.map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

export function normalizePublicSiteUrl(value: string): string | null {
  const raw = value.trim().replace(/[),.;!?]+$/, "");
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!["http:", "https:"].includes(url.protocol) || !host.includes(".") ||
      url.username || url.password || host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") || isPrivateIpv4(host) ||
      host === "169.254.169.254" || host === "metadata.google.internal") return null;
    if (host === "0.0.0.0" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return null;
    url.hash = "";
    url.hostname = host;
    return url.toString().replace(/\/$/, url.pathname === "/" && !url.search ? "" : "/");
  } catch {
    return null;
  }
}

export function isExternalSiteAuditGoal(goal: string): boolean {
  return /\b(?:audit|analy[sz]e|check|review|crawl|inspect)\b|تدقيق|افحص|فحص|حلل|تحليل|راجع|مراجعة/i.test(String(goal || ""));
}

export function extractSiteUrlFromGoal(goal: string): string | null {
  const matches = goal.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]{2,})+(?::\d{1,5})?(?:\/[a-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?/gi) || [];
  for (const candidate of matches) {
    const normalized = normalizePublicSiteUrl(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function jsonLdObjects(html: string): any[] {
  const blocks = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const values: any[] = [];
  for (const block of blocks) {
    const content = block.replace(/^.*?>/s, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(content);
      const add = (v: any) => {
        if (Array.isArray(v)) v.forEach(add);
        else if (v && typeof v === "object") {
          values.push(v);
          if (Array.isArray(v["@graph"])) v["@graph"].forEach(add);
          if (v.mainEntity) add(v.mainEntity);
        }
      };
      add(parsed);
    } catch {}
  }
  return values;
}

function plain(value: unknown): string {
  return typeof value === "string" ? decodeEntities(value).replace(/\s+/g, " ").trim() : "";
}

function classifySector(text: string, schemaTypes: string[]): { sector: string | null; site_type: DiscoveredSite["site_type"] } {
  const t = text.toLowerCase();
  const commerce = schemaTypes.some((x) => /product|offer|store|itemlist/i.test(x)) ||
    /add to cart|shopping cart|checkout|product price|shop now|\bsku\b/i.test(t);
  const publisher = schemaTypes.some((x) => /newsarticle|article|blogposting|periodical/i.test(x)) ||
    /latest news|editorial|published on|author:/i.test(t);
  const software = schemaTypes.some((x) => /softwareapplication|mobileapplication/i.test(x)) ||
    /\bsaas\b|software platform|download the app|api documentation/i.test(t);
  const service = schemaTypes.some((x) => /localbusiness|professionalservice|organization/i.test(x)) ||
    /book an appointment|our services|contact our team|service provider/i.test(t);
  if (commerce) {
    if (/fashion|apparel|clothing|garment|dress|footwear/i.test(t)) return { sector: "E-commerce / Fashion & Apparel", site_type: "ecommerce" };
    if (/fragrance|perfume|beauty|skincare|cosmetic/i.test(t)) return { sector: "E-commerce / Beauty & Fragrances", site_type: "ecommerce" };
    if (/electronics|laptop|smartphone|computer/i.test(t)) return { sector: "E-commerce / Electronics", site_type: "ecommerce" };
    if (/furniture|home decor|kitchenware|homeware/i.test(t)) return { sector: "E-commerce / Home & Living", site_type: "ecommerce" };
    return { sector: "E-commerce / General Retail", site_type: "ecommerce" };
  }
  if (software) return { sector: "Software / Technology", site_type: "software" };
  if (publisher) return { sector: "Publishing / Media", site_type: "publisher" };
  if (service) return { sector: "Services / Organization", site_type: "service_business" };
  return { sector: null, site_type: "unknown" };
}

function countryEvidence(text: string, hostname: string): { country: string | null; status: DiscoveredSite["country_status"] } {
  const t = text.toLowerCase();
  const explicit: Array<[RegExp, string]> = [
    [/\b(lebanon|lebanese|beirut|tripoli,? lebanon|lbp|\+?961)\b/i, "Lebanon"],
    [/\b(iraq|iraqi|baghdad|iqd|\+?964)\b/i, "Iraq"],
    [/\b(united arab emirates|uae|dubai|abu dhabi|aed|\+?971)\b/i, "United Arab Emirates"],
    [/\b(saudi arabia|saudi|riyadh|sar|\+?966)\b/i, "Saudi Arabia"],
    [/\b(united kingdom|\buk\b|london|gbp|\+?44)\b/i, "United Kingdom"],
    [/\b(united states|\busa\b|\busd\b|\+?1)\b/i, "United States"],
  ];
  for (const [pattern, country] of explicit) if (pattern.test(t)) return { country, status: "explicit_site_evidence" };
  const tld = hostname.split(".").pop()?.toLowerCase();
  const cc: Record<string, string> = { lb: "Lebanon", iq: "Iraq", ae: "United Arab Emirates", sa: "Saudi Arabia", uk: "United Kingdom", us: "United States" };
  return cc[tld || ""] ? { country: cc[tld || ""], status: "country_code_domain" } : { country: null, status: "not_established" };
}

export function extractDiscoveredSite(urlValue: string, page: SiteDiscoveryEvidence): DiscoveredSite | null {
  const url = normalizePublicSiteUrl(urlValue);
  if (!url) return null;
  const parsed = new URL(url);
  const html = page.html || "";
  const schema = jsonLdObjects(html);
  const schemaTypes = schema.flatMap((item) => {
    const type = item["@type"];
    return Array.isArray(type) ? type.map(String) : type ? [String(type)] : [];
  });
  const organization = schema.find((item) => /Organization|LocalBusiness|Store|Corporation/i.test(
    Array.isArray(item["@type"]) ? item["@type"].join(" ") : String(item["@type"] || ""),
  ));
  const productText = [page.title, page.description, page.markdown, html.slice(0, 18000)].filter(Boolean).join("\n");
  const title = plain(page.title);
  const description = plain(page.description);
  const schemaName = plain(organization?.name);
  const titleNameCandidate = title.split(/\s+[|–—-]\s+/)[0].trim();
  const titleName = /^(home|homepage|welcome|untitled|404|page not found|online store)$/i.test(titleNameCandidate) ? "" : titleNameCandidate;
  const brand = schemaName || titleName || null;
  const brandStatus: DiscoveredSite["brand_name_status"] = schemaName
    ? "verified_from_structured_data"
    : titleName ? "derived_from_page_title" : "domain_fallback";
  const sector = classifySector(productText, schemaTypes);
  const country = countryEvidence(productText, parsed.hostname);
  const domainLabel = parsed.hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const displayName = brand || domainLabel;
  const evidence: DiscoveredSite["evidence"] = [];
  if (schemaName) evidence.push({ field: "brand_name", source: "json_ld_organization", excerpt: schemaName.slice(0, 160) });
  else if (titleName) evidence.push({ field: "brand_name", source: "page_title", excerpt: titleName.slice(0, 160) });
  else evidence.push({ field: "display_name", source: "domain", excerpt: parsed.hostname });
  if (sector.sector) evidence.push({ field: "sector", source: schemaTypes.length ? "schema_and_page_content" : "page_content", excerpt: sector.sector });
  if (country.country) evidence.push({ field: "country", source: country.status, excerpt: country.country });
  const confidence: DiscoveredSite["confidence"] = schemaName && sector.sector && country.country ? "high"
    : (brand && (sector.sector || country.country) ? "medium" : "low");
  return {
    url, hostname: parsed.hostname, display_name: displayName,
    brand_name: brand, brand_name_status: brandStatus,
    sector: sector.sector, sector_status: sector.sector ? "evidence_inferred" : "not_established",
    site_type: sector.site_type, country: country.country, country_status: country.status,
    confidence, evidence, source: page.source || null,
    status_code: page.statusCode ?? null,
  };
}
