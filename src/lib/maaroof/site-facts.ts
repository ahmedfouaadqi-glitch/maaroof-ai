import type { DiscoveredSite } from "./site-intake";
import { discoverFact, type DiscoveredFact } from "./fact-discovery";

/**
 * Converts only fields that site-intake tied to an explicit page/domain signal.
 * Missing fields stay missing; this adapter does not fill gaps with guesses.
 */
export function factsFromDiscoveredSite(
  site: DiscoveredSite,
  collectedAt = new Date().toISOString(),
  collectionMethod = "public_site_crawl",
): DiscoveredFact[] {
  const facts: DiscoveredFact[] = [];
  for (const item of site.evidence) {
    const value = item.field === "brand_name" ? site.brand_name
      : item.field === "sector" ? site.sector
      : item.field === "country" ? site.country
      : item.field === "display_name" ? site.display_name
      : null;
    if (value == null || value === "") continue;
    const inferred = item.field === "sector" || site.country_status === "country_code_domain";
    facts.push(discoverFact({
      key: `site:${site.hostname}:${item.field}`,
      subject: site.hostname,
      predicate: item.field,
      value,
      kind: inferred ? "inferred_finding" : "observed_fact",
      rationale: inferred ? `Classified from ${item.source}; not a direct business declaration.` : null,
      evidence: [{
        source_kind: item.source,
        source_ref: site.url,
        locator: item.field,
        excerpt: item.excerpt,
        collected_at: collectedAt,
        collection_method: collectionMethod,
      }],
    }));
  }
  return facts;
}
