import { describe, it, expect } from "vitest";
import { isPublicUrl, looksExposed, buildChecks, securityScore } from "@/lib/security-scan";

describe("security scan rules", () => {
  it("blocks internal addresses", () => {
    for (const u of ["http://localhost", "http://127.0.0.1", "http://10.0.0.1", "http://192.168.1.1", "http://169.254.169.254", "http://172.16.0.1", "ftp://example.com", "http://[::1]"]) expect(isPublicUrl(u)).toBe(false);
  });
  it("allows public sites", () => { expect(isPublicUrl("https://maaroofai.com")).toBe(true); });
  it("SPA fallback page is not an exposed .env", () => {
    expect(looksExposed("/.env", 200, "<!doctype html><html>")).toBe(false);
    expect(looksExposed("/.env", 200, "DB_PASS=x")).toBe(true);
    expect(looksExposed("/.env", 404, "DB_PASS=x")).toBe(false);
  });
  it("full marks only when every check passes", () => {
    const h = { "strict-transport-security": "1", "content-security-policy": "1", "x-frame-options": "1", "x-content-type-options": "1", "referrer-policy": "1" };
    expect(securityScore(buildChecks({ finalUrl: "https://a.com", headers: h, exposed: [], brokenLinks: [], checkedLinks: 3 }))).toBe(100);
    expect(securityScore(buildChecks({ finalUrl: "http://a.com", headers: h, exposed: [], brokenLinks: [], checkedLinks: 3 }))).toBe(80);
  });
});
