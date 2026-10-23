import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROUTES = ["feasibility", "bizdev", "visibility", "geo-rewrite", "applied-ranking", "compare", "suggest", "analyze", "what-if", "social-analysis", "geo-strategist", "brand-authority"];

describe("tools are gated by balance only", () => {
  for (const r of ROUTES) {
    it(`${r} no longer returns the legacy monthly limit`, () => {
      const src = readFileSync(`src/routes/api/${r}.ts`, "utf8");
      expect(src).not.toMatch(/error: "limit"/);
      expect(src).not.toMatch(/error: "subscription_required"/);
    });
  }
});
