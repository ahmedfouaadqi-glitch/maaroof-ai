import { describe, it, expect } from "vitest";
import { fromVisibility, cardsForStep } from "@/lib/engine-card-adapters";
import { councilCards } from "@/lib/maaroof/report-sections";
import { liveExample } from "@/lib/maaroof/mode-report";
describe("phase 3/4", () => {
  it("visibility: probe measured, platforms estimated, no invented score", () => {
    const r = fromVisibility({ probe: { answers: [{ engine: "chatgpt", mentioned: true, rank: 2, answer: "x", brands: [] }] }, platforms: [{ name: "ChatGPT", score: 10 }, { name: "Gemini" }] });
    expect(r[0]).toMatchObject({ key: "chatgpt", basis: "measured", score: null });
    expect(r[1]).toMatchObject({ key: "gemini", basis: "estimated", score: null });
    expect(cardsForStep("visibility", {})).toEqual([]);
  });
  it("council cards have no braces", () => {
    const c = councilCards([{ type: "council", data: { expert: "seo", opinion: { a: 1 }, objection: "risk" } }, { type: "council", data: { error: "x" } }]);
    expect(c.length).toBe(2); expect(c.every((x) => !/[{}]/.test(x.text))).toBe(true);
  });
  it("live example uses session data or null", () => {
    expect(liveExample("execution", {}, "ar")).toBeNull();
    expect(liveExample("execution", { brand: "Zain", country: "العراق" }, "ar")).toContain("Zain");
  });
});
