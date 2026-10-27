import { describe, it, expect } from "vitest";
import { sanitizeProviderNames, sanitizeDeep, hasProviderNames } from "./brand-sanitize";

describe("provider name sanitizer", () => {
  it("removes Arabic and English provider names", () => {
    const out = sanitizeProviderNames("طبقة الإسكندرية و Firecrawl و OpenRouter و فاير كرول", "ar");
    expect(hasProviderNames(out)).toBe(false);
    expect(out).toContain("طبقة الأدلة والبيانات المهيكلة");
  });
  it("is case-insensitive in English", () => {
    expect(sanitizeProviderNames("FIRE CRAWL alexandria openrouter")).toBe("Verified Digital Evidence Engine Structured Evidence & Data Layer AI Engine Council");
  });
  it("keeps URLs and nested values", () => {
    const v = sanitizeDeep({ a: ["Alexandria evidence", "https://firecrawl.dev/x"], n: 3 });
    expect(v).toEqual({ a: ["Structured Evidence & Data Layer", "https://firecrawl.dev/x"], n: 3 });
  });
});
