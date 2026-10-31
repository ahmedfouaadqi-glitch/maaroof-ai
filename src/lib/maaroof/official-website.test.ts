import { describe, expect, it } from "vitest";
import { normalizeOfficialWebsite } from "./official-website";

describe("normalizeOfficialWebsite", () => {
  it("normalizes public HTTP and HTTPS website URLs", () => {
    expect(normalizeOfficialWebsite("www.example.com/")).toBe("https://www.example.com");
    expect(normalizeOfficialWebsite("https://shop.example.com/about/?campaign=1#top")).toBe("https://shop.example.com/about");
    expect(normalizeOfficialWebsite("http://example.com")).toBe("http://example.com");
  });

  it.each([
    "localhost",
    "https://localhost",
    "http://api.localhost",
    "http://printer.local",
    "http://service.internal",
    "http://127.0.0.1",
    "http://10.0.0.8",
    "http://192.168.1.10",
    "http://[::1]",
    "http://169.254.169.254/latest/meta-data",
    "http://anything.nip.io",
    "http://anything.sslip.io",
  ])("rejects local, literal-IP, or rebinding-style host: %s", (value) => {
    expect(normalizeOfficialWebsite(value)).toBeNull();
  });

  it.each([
    "ftp://example.com",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com:8443",
    "example",
    "",
    "x".repeat(501),
  ])("rejects malformed or unsupported URL: %s", (value) => {
    expect(normalizeOfficialWebsite(value)).toBeNull();
  });
});
