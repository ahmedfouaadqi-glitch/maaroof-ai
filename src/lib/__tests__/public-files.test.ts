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
    expect(robots).toMatch(/Sitemap: https:\/\/geoiraq\.com\/sitemap\.xml/);
  });

  it("includes the methodology page in the sitemap", () => {
    const sitemap = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");
    expect(sitemap).toContain('path: "/methodology"');
  });
});
