import { describe, it, expect } from "vitest";
import { enginesForPlan, engineLimitForPlan } from "@/lib/ai-engines";
import { entityFromResult, engineAnswerSections, buildPack } from "@/lib/machine-pack";
import { groundedSystemPrompt } from "@/lib/maaroof/chat-policy";

describe("ten-engine council for every account", () => {
  it("free plan gets all ten", () => { expect(engineLimitForPlan(null)).toBe(10); expect(enginesForPlan("MARK 1")).toHaveLength(10); });
});
describe("pack from the examined entity", () => {
  it("uses result brand and faqs, not the profile", () => {
    const e = entityFromResult({ brand: "Mengotti", website: "https://m.com", faq: [{ question: "Q?", answer: "A." }] })!;
    expect(e.brand).toBe("Mengotti");
    const p = buildPack({ brand: e.brand, site: e.site, onboarding: { faqs: e.faqs } });
    expect(p.orgJsonld).toContain("https://m.com");
    expect(p.faqJsonld).toContain("Q?");
  });
  it("returns null without a brand (no invention)", () => { expect(entityFromResult({ score: 3 })).toBeNull(); });
});
describe("engine sections in export", () => {
  it("one section per answering engine with real sources only", () => {
    const s = engineAnswerSections({ probe: { answers: [{ engine: "gemini", mentioned: false, rank: null, answer: "x", brands: [], sources: [{ url: "notaurl" }] }] } });
    expect(s[0].heading).toBe("Gemini");
    expect(JSON.stringify(s)).toContain("لا يوجد مصدر مسجل");
  });
  it("labels follow the export language", () => {
    const r = { probe: { answers: [{ engine: "claude", mentioned: true, rank: 2, answer: "x", sources: [] }] } };
    expect(engineAnswerSections(r, "en")[0].rows![0][0]).toBe("Status");
    expect(engineAnswerSections(r, "ku")[0].rows![0][0]).toBe("دۆخ");
  });
});
describe("chat identity", () => {
  it("names the founder", () => { expect(groundedSystemPrompt("ar", [])).toContain("Ahmed Maaroof"); });
});
import { parseReply } from "@/lib/maaroof/chat-policy";
describe("chat task marker", () => {
  it("parses a proposed task and hides the marker", () => {
    const r = parseReply('سأفحص. [[TASK:{"kind":"scan","goal":"افحص ظهور X في السعودية"}]]');
    expect(r.task).toEqual({ kind: "scan", goal: "افحص ظهور X في السعودية" });
    expect(r.text).toBe("سأفحص.");
  });
  it("rejects unknown kinds", () => { expect(parseReply('[[TASK:{"kind":"buy","goal":"x"}]]').task).toBeNull(); });
});
