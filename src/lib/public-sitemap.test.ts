import { describe, expect, it } from "vitest";
import { buildPublicSitemapXml, PUBLIC_SITEMAP_ENTRIES } from "./public-sitemap";

describe("public sitemap", () => {
  it("contains only unique absolute public page paths", () => {
    const paths = PUBLIC_SITEMAP_ENTRIES.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.startsWith("/") && !path.startsWith("//"))).toBe(true);
  });

  it("excludes authenticated, API and database-backed dynamic routes", () => {
    const paths = PUBLIC_SITEMAP_ENTRIES.map((entry) => entry.path);
    for (const forbidden of ["/auth", "/dashboard", "/agent", "/maaroof/memory", "/api/"]) {
      expect(paths.some((path) => path === forbidden || path.startsWith(forbidden))).toBe(false);
    }
    expect(paths.some((path) => path.startsWith("/u/") || path.startsWith("/p/"))).toBe(false);
  });

  it("generates valid XML structure with canonical HTTPS URLs", () => {
    const xml = buildPublicSitemapXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
    expect(xml).toContain("<loc>https://maaroofai.com/</loc>");
    expect(xml).not.toContain("SUPABASE");
    expect(xml.match(/<url>/g)?.length).toBe(PUBLIC_SITEMAP_ENTRIES.length);
  });
});
