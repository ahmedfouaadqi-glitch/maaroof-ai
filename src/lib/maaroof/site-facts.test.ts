import { describe, expect, it } from "vitest";
import { extractDiscoveredSite } from "./site-intake";
import { factsFromDiscoveredSite } from "./site-facts";

describe("site intake fact bridge", () => {
  it("converts extracted site evidence into traceable facts without inventing missing fields", () => {
    const site = extractDiscoveredSite("https://shop.example", {
      title: "Shop Example",
      description: "Shop Example offers fashion products and online checkout.",
      markdown: "Shop Example fashion store. Add to cart and checkout.",
      html: '<script type="application/ld+json">{"@type":"Organization","name":"Shop Example"}</script>',
      statusCode: 200,
      source: "firecrawl",
    })!;
    const facts = factsFromDiscoveredSite(site, "2026-11-15T10:00:00.000Z");
    expect(facts.some((f) => f.predicate === "brand_name" && f.status === "supported")).toBe(true);
    expect(facts.some((f) => f.predicate === "sector" && f.status === "needs_validation")).toBe(true);
    expect(facts.every((f) => f.evidence[0].source_ref === site.url)).toBe(true);
    expect(facts.some((f) => f.predicate === "country")).toBe(false);
  });

  it("does not create facts when the source extractor has no evidence", () => {
    const site = extractDiscoveredSite("https://unknown.example", {
      title: "Home", description: "", markdown: "", html: "", statusCode: 200,
    })!;
    expect(factsFromDiscoveredSite(site)).toEqual([]);
  });
});
