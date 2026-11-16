import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("public discovery + app-link files", () => {
  it("exposes a valid Android asset links file for the TWA", () => {
    const raw = readFileSync("public/.well-known/assetlinks.json", "utf8");
    const parsed = JSON.parse(raw) as Array<any>;
    expect(Array.isArray(parsed)).toBe(true);
    const target = parsed[0].target;
    expect(target.namespace).toBe("android_app");
    expect(target.package_name).toBe("com.maaroofai.app");
    expect(target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(parsed[0].relation).toContain("delegate_permission/common.handle_all_urls");
  });

  it("keeps robots.txt crawlable and pointing at the sitemap", () => {
    const robots = readFileSync("public/robots.txt", "utf8");
    expect(robots).toMatch(/User-agent: \*/);
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).toMatch(/Sitemap: https:\/\/maaroofai\.com\/sitemap\.xml/);
  });

  it("keeps core public pages aligned with the official social preview image", () => {
    const paths = [
      "src/routes/index.tsx",
      "src/routes/pricing.tsx",
      "src/routes/guide.geo-vs-aeo.tsx",
      "src/routes/guide.what-is-geo.tsx",
      "src/routes/guide.arabic-kurdish-geo.tsx",
      "src/routes/methodology.tsx",
      "src/routes/contact.tsx",
    ];
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toContain("https://maaroofai.com/og-maaroof.png");
    }
  });

  it("does not advertise a stale nine-engine count in the GEO vs AEO guide", () => {
    const guide = readFileSync("src/routes/guide.geo-vs-aeo.tsx", "utf8");
    expect(guide).not.toMatch(/across 9 AI engines/i);
    expect(guide).toContain("supported AI engines");
  });

  it("includes the methodology page in the sitemap", () => {
    const sitemap = readFileSync("src/lib/public-sitemap.ts", "utf8");
    expect(sitemap).toContain('path: "/methodology"');
  });
});
