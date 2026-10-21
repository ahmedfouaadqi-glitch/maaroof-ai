import { describe, it, expect } from "vitest";
import { normalizeDomain, isUrlAllowed, isGrantActive, clampMinutes, isForbiddenInstruction, allowedLinks } from "./delegated-browser";

describe("delegated browser rules", () => {
  it("normalizes domains and rejects internal hosts", () => {
    expect(normalizeDomain("https://www.Example.com/x")).toBe("example.com");
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("192.168.1.1")).toBeNull();
  });
  it("allows only granted domains and their subdomains", () => {
    expect(isUrlAllowed("https://blog.example.com/a", ["example.com"])).toBe(true);
    expect(isUrlAllowed("https://evil-example.com", ["example.com"])).toBe(false);
    expect(isUrlAllowed("file:///etc/passwd", ["example.com"])).toBe(false);
    expect(isUrlAllowed("https://u:p@example.com", ["example.com"])).toBe(false);
  });
  it("grant expires and can be revoked", () => {
    const now = Date.now();
    expect(isGrantActive({ revoked: false, expires_at: new Date(now + 60000).toISOString() }, now)).toBe(true);
    expect(isGrantActive({ revoked: false, expires_at: new Date(now - 1).toISOString() }, now)).toBe(false);
    expect(isGrantActive({ revoked: true, expires_at: new Date(now + 60000).toISOString() }, now)).toBe(false);
  });
  it("session length defaults to 30 and caps at 120 minutes", () => {
    expect(clampMinutes(undefined)).toBe(30);
    expect(clampMinutes(500)).toBe(120);
  });
  it("refuses passwords, purchases, publishing and form submission", () => {
    expect(isForbiddenInstruction("أدخل كلمة المرور")).toBe(true);
    expect(isForbiddenInstruction("buy the plan")).toBe(true);
    expect(isForbiddenInstruction("اقرأ صفحة الأسعار")).toBe(false);
  });
  it("filters links to the granted domains", () => {
    expect(allowedLinks(["https://example.com/a#x", "https://other.com"], ["example.com"])).toEqual(["https://example.com/a"]);
  });
});
