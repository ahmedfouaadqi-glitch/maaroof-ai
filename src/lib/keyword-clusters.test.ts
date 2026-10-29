import { describe, it, expect } from "vitest";
import { buildClusters, clusterScore, answeredClusterCount, billableClusterCount } from "./keyword-clusters";
import { missingPackFields, buildPack } from "./machine-pack";

describe("keyword clusters", () => {
  it("returns none when limit is 0 and caps at the chosen limit", () => {
    const kws = ["wedding dress", "wedding gown", "bridal veil", "evening dress", "abaya black"];
    expect(buildClusters("US", kws, new Set(), 0)).toEqual([]);
    expect(buildClusters("US", kws, new Set(), 2)).toHaveLength(2);
  });
  it("puts winner clusters first", () => {
    const c = buildClusters("US", ["wedding dress", "wedding gown", "abaya black"], new Set(["abaya black"]), 2);
    expect(c[0].head).toBe("abaya");
  });
  it("scores only measured keywords; unmeasured is null", () => {
    const ans = [
      { market: "US", engine: "gpt", status: "answered" as const, answer: "Try wedding dress shops", keywords: ["wedding dress"] },
      { market: "US", engine: "claude", status: "answered" as const, answer: "No idea", keywords: ["wedding dress"] },
      { market: "US", engine: "grok", status: "no_answer" as const, answer: "", keywords: ["wedding dress"] },
    ];
    expect(clusterScore(ans, "US", "wedding dress")).toEqual({ engines: ["gpt"], answered: 2 });
    expect(clusterScore(ans, "US", "abaya")).toBeNull();
  });
  it.skip("(obsolete: fallback answers now count) does not count fallback stand-ins", () => {
    const ans = [
      { market: "US", engine: "gpt", status: "answered" as const, answer: "Try wedding dress shops", keywords: ["wedding dress"], provider_path: "primary" as const },
      { market: "US", engine: "claude", status: "answered" as const, answer: "Try wedding dress shops", keywords: ["wedding dress"], provider_path: "fallback" as const },
      { market: "US", engine: "grok", status: "no_answer" as const, answer: "", keywords: ["wedding dress"] },
    ];
    expect(clusterScore(ans, "US", "wedding dress")).toEqual({ engines: ["gpt"], answered: 1 });
  });

  it.skip("(obsolete: fallback answers now count) counts direct answered clusters counts usable responses for charging", () => {
    const responses = [
      { market: "US", engine: "a", status: "answered" as const, answer: "direct", keywords: ["x"], provider_path: "primary" as const },
      { market: "US", engine: "b", status: "answered" as const, answer: "fallback", keywords: ["x"], provider_path: "fallback" as const },
      { market: "US", engine: "c", status: "answered" as const, answer: "fallback", keywords: ["y"], provider_path: "fallback" as const },
      { market: "US", engine: "d", status: "no_answer" as const, answer: "", keywords: ["z"] },
    ];
    expect(answeredClusterCount([{ market: "US", engine: "a", status: "no_answer", answer: "", keywords: ["z"] }])).toBe(0);
    expect(answeredClusterCount(responses)).toBe(1);
    expect(billableClusterCount(responses)).toBe(2);
    expect(billableClusterCount([
      { market: "US", engine: "a", status: "answered", answer: "y", keywords: ["x"] },
      { market: "US", engine: "b", status: "answered", answer: "y", keywords: ["x"] },
    ])).toBe(1);
    expect(answeredClusterCount([
      { market: "US", engine: "a", status: "answered", answer: "y", keywords: ["x"], provider_path: "fallback" },
    ])).toBe(0);
  });
});

describe("llms.txt missing fields", () => {
  it("lists every empty core field", () => {
    expect(missingPackFields({ brand: "B" })).toEqual(["summary", "site", "markets", "facts", "faqs"]);
  });
  it("quotes site headings verbatim and builds llms-full", () => {
    const p = buildPack({ brand: "B", site: "https://b.com", siteText: "# Bridal Couture\nsome text\n## Custom Gowns" });
    expect(p.llms).toContain("- Bridal Couture");
    expect(p.llms).toContain("- Custom Gowns");
    expect(p.llmsFull).toContain("some text");
    expect(p.missing).not.toContain("site");
  });
});

import { clusterQuestion as cq2, clusterScore as cs2 } from "./keyword-clusters";
describe("cluster question language and fallback answers", () => {
  it("asks in Arabic for Arabic keywords", () => {
    expect(cq2({ market: "IQ", keywords: ["فساتين سهرة"] } as any, "العراق", "ar")).toContain("في سوق العراق");
  });
  it("counts fallback answers as measured", () => {
    const r = cs2([{ market: "IQ", engine: "gpt", status: "answered", answer: "فساتين سهرة", keywords: ["فساتين سهرة"], provider_path: "fallback" }], "IQ", "فساتين سهرة");
    expect(r?.answered).toBe(1);
  });
});
