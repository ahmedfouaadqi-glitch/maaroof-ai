import { describe, expect, it } from "vitest";
import { extractDiscoveredSite, extractSiteUrlFromGoal, normalizePublicSiteUrl } from "./site-intake";

describe("site URL intake", () => {
  it("extracts and normalizes a URL from natural-language audit requests", () => {
    expect(extractSiteUrlFromGoal("can u audit this website : https://shopandbeyondlb.com")).toBe("https://shopandbeyondlb.com");
    expect(extractSiteUrlFromGoal("افحص https://example.com/products?x=1.")).toBe("https://example.com/products?x=1");
  });
  it("rejects local, private and credential-bearing URLs", () => {
    expect(normalizePublicSiteUrl("http://localhost:3000")).toBeNull();
    expect(normalizePublicSiteUrl("http://192.168.1.2")).toBeNull();
    expect(normalizePublicSiteUrl("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(normalizePublicSiteUrl("https://user:pass@example.com")).toBeNull();
  });
  it("does not infer a country from a generic .com domain or the platform profile", () => {
    const site = extractDiscoveredSite("https://shopandbeyondlb.com", {
      title: "Shop & Beyond | Online Store",
      description: "Shop fashion, fragrances and home products online.",
      markdown: "Products, add to cart, checkout and product prices.",
    })!;
    expect(site.brand_name).toBe("Shop & Beyond");
    expect(site.sector).toBe("E-commerce / Fashion & Apparel");
    expect(site.country).toBeNull();
    expect(site.country_status).toBe("not_established");
  });
  it("uses explicit schema and page evidence for identity, sector and market", () => {
    const site = extractDiscoveredSite("https://example.com", {
      title: "Example",
      description: "Online fashion shop in Beirut, Lebanon. +961 1 234 567",
      markdown: "Add to cart. Fashion and fragrances.",
      html: '<script type="application/ld+json">{"@type":"Organization","name":"Example Ltd"}</script><script type="application/ld+json">{"@type":"Product","name":"Dress"}</script>',
      statusCode: 200,
      source: "direct_http",
    })!;
    expect(site.brand_name).toBe("Example Ltd");
    expect(site.sector).toContain("E-commerce");
    expect(site.country).toBe("Lebanon");
    expect(site.brand_name_status).toBe("verified_from_structured_data");
  });
});
