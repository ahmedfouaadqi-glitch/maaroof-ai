import { describe, it, expect } from "vitest";
import { discoveryConsensus, extractPhrases, stratifiedSample } from "./keyword-discovery";

const ans = (engine: string, answer: string) => ({ market: "iq", engine, status: "answered", answer });

describe("keyword discovery from engine answers", () => {
  it("confirms a phrase named by two engines and tags a single-engine phrase", () => {
    const out = discoveryConsensus([
      ans("chatgpt", "- فساتين سهرة فاخرة\n- عبايات مطرزة"),
      ans("gemini", "1. فساتين سهرة فاخرة\n2. تفصيل فساتين زفاف"),
    ], []);
    const a = out.find((k) => k.keyword === "فساتين سهرة فاخرة")!;
    const b = out.find((k) => k.keyword === "عبايات مطرزة")!;
    expect(a.confirmed).toBe(true);
    expect(a.engines).toEqual(["chatgpt", "gemini"]);
    expect(b.confirmed).toBe(false);
  });
  it("only returns phrases that appear literally in an answer", () => {
    const out = discoveryConsensus([ans("chatgpt", "- evening gowns baghdad")], []);
    expect(out.map((k) => k.keyword)).toEqual(["evening gowns baghdad"]);
  });
  it("drops already-known keywords and technical noise", () => {
    expect(extractPhrases("- 3000x3000 photo\n- 62k followers now\n- bridal couture")).toEqual(["bridal couture"]);
    expect(discoveryConsensus([ans("x", "- bridal couture")], ["Bridal Couture"])).toEqual([]);
  });
  it("stratified sample covers every tab and respects the limit", () => {
    const s = stratifiedSample([["a1", "a2", "a3"], ["b1", "b2"], ["c1"]], 4);
    expect(s).toEqual(["a1", "b1", "c1", "a2"]);
  });
  it("expanding the sample skips keywords already measured", () => {
    const s = stratifiedSample([["a1", "a2", "a3"]], 2, ["a1"]);
    expect(s).toEqual(["a2", "a3"]);
  });
});
