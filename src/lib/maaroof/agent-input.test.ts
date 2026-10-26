import { describe, it, expect } from "vitest";
import { extractRewriteSourceText, fillToolInput, fillFromTask, missingFields, sanitizeReflection } from "./agent-input";

describe("agent-input", () => {
  it("fills the tool's own brand key with priority goal > workspace > profile", () => {
    const ctx = { goalBrand: "G", workspace: { name: "W" }, profile: { brand_name: "P" } };
    expect(fillToolInput("brand_boost", {}, ctx).brand_name).toBe("G");
    expect(fillToolInput("company_email", {}, { workspace: { name: "W" }, profile: { brand_name: "P" } }).company).toBe("W");
    expect(fillToolInput("visibility", {}, { profile: { brand_name: "P" } }).brand).toBe("P");
  });
  it("never overwrites planner values", () => {
    expect(fillToolInput("visibility", { brand: "X" }, { goalBrand: "G" }).brand).toBe("X");
  });
  it("reports missing required fields", () => {
    expect(missingFields("visibility", fillToolInput("visibility", {}, {}))).toEqual(["brand"]);
    expect(missingFields("research", fillToolInput("research", {}, { goal: "best perfume shops" }))).toEqual([]);
  });
  it("turns JSON reflections into plain text", () => {
    expect(sanitizeReflection('```json\n{"decision":"stop","why":"brand missing"}\n```')).toBe("stop — brand missing");
    expect(sanitizeReflection("continue")).toBe("continue");
  });
  it("requires a real source passage for GEO rewrite", () => {
    expect(missingFields("geo_rewrite", {})).toEqual(["text"]);
    expect(missingFields("geo_rewrite", { text: "too short" })).toEqual(["text"]);
    expect(missingFields("geo_rewrite", { text: "A sufficiently long original paragraph for accurate rewriting." })).toEqual([]);
  });

  it("fills GEO rewrite text from the best successful earlier content", () => {
    const prior = [
      { tool: "known", ok: true, output: { url: "https://example.com", brand: "Acme" } },
      { tool: "suggest", ok: true, output: { suggested_posts: [{ caption: "Acme explains its verified service process and the customer support options available to buyers." }] } },
      { tool: "research", ok: false, output: { summary: "This failed result must never be used as the rewrite source." } },
    ];
    const filled = fillFromTask("geo_rewrite", {}, prior);
    expect(filled.text).toContain("Acme explains its verified service process");
    expect(String(filled.text).length).toBeGreaterThanOrEqual(25);
    expect(missingFields("geo_rewrite", filled)).toEqual([]);
  });

  it("asks for source text rather than inventing it when no usable context exists", () => {
    const filled = fillFromTask("geo_rewrite", {}, [
      { tool: "known", ok: true, output: { url: "https://example.com", brand: "Acme" } },
      { tool: "suggest", ok: false, output: { caption: "This failed draft must not be reused." } },
    ]);
    expect(filled.text).toBeUndefined();
    expect(missingFields("geo_rewrite", filled)).toEqual(["text"]);
    expect(extractRewriteSourceText([{ tool: "known", ok: true, output: { url: "https://example.com" } }])).toBe("");
  });
});
