import { describe, it, expect } from "vitest";
import { buildPack, extractLinks, linksSection, packSections } from "@/lib/machine-pack";

const ob = { aliases: "معروف, Maaroof", facts: "Founded in 2024", links: "https://maaroofai.com\nhttps://example.com/press", officialProfiles: "https://linkedin.com/company/maaroof", faqs: [{ q: "What is GEO?", a: "Optimizing for AI answers." }] };

describe("machine pack", () => {
  it("builds Organization JSON-LD only from given data", () => {
    const p = buildPack({ brand: "Maaroof Ai", site: "https://maaroofai.com", markets: ["Iraq", "Lebanon"], onboarding: ob });
    const org = JSON.parse(p.orgJsonld);
    expect(org.url).toBe("https://maaroofai.com");
    expect(org.sameAs).toEqual(["https://linkedin.com/company/maaroof"]);
    expect(buildPack({ brand: "X", onboarding: { links: "https://unconfirmed.example/page" } }).orgJsonld).not.toContain('"url": "https://unconfirmed.example/page"');
    expect(org.areaServed.map((x: any) => x.name)).toEqual(["Iraq", "Lebanon"]);
    expect(org.areaServed.every((x: any) => x["@type"] === "Place")).toBe(true);
    expect(org.sameAs).not.toContain("https://example.com/press");
    expect(p.orgJsonld).not.toMatch(/\b(99|1000)\b/);
  });
  it("builds a valid FAQPage only when FAQs exist", () => {
    expect(JSON.parse(buildPack({ brand: "X", onboarding: ob }).faqJsonld)["@type"]).toBe("FAQPage");
    expect(buildPack({ brand: "X" }).faqJsonld).toBe("");
    const noFaqSections = packSections({ brand: "X", site: "https://x.example" }, "ar");
    expect(noFaqSections.some((section) => section.heading.includes("FAQPage"))).toBe(false);
  });

  it("does not create a publishable pack from a name alone", () => {
    expect(buildPack({ brand: "X" }).llms).toBe("");
    expect(buildPack({ brand: "X" }).orgJsonld).toBe("");
    expect(packSections({ brand: "X" }, "ar")).toEqual([]);
  });
  it("extracts real links from results and says so when none", () => {
    const s = [{ heading: "a", kind: "text" as const, text: "see https://a.com/x." }];
    expect(extractLinks(s)).toEqual(["https://a.com/x"]);
    expect(linksSection([], "ar").text).toBe("لا يوجد مصدر مسجل لهذه النتائج.");
  });
  it("explains each file in the chosen language without mixing", () => {
    const ar = JSON.stringify(packSections({ brand: "X", onboarding: ob }, "ar"));
    expect(ar).toContain("طريقة الاستخدام");
    expect(ar).not.toContain("How to use");
    const en = JSON.stringify(packSections({ brand: "X", onboarding: ob }, "en"));
    expect(en).toContain("How to use");
    expect(en).not.toContain("طريقة الاستخدام");
  });
});

import { probeBatches } from "@/lib/maaroof/probe-answer";
describe("probeBatches", () => {
  it("splits ten engines into batches of 3,3,3,1", () => {
    expect(probeBatches(Array.from({ length: 10 }, (_, i) => i), 3).map((b) => b.length)).toEqual([3, 3, 3, 1]);
  });
});
