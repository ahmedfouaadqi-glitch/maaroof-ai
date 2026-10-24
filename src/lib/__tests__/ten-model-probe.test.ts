import { describe, it, expect } from "vitest";
import { parseProbeContent, linkSources, probeRefund, probePhaseRefund, blindProbeQuestion, stripAgentOnlyFields, PROBE_MAX_TOKENS } from "@/lib/maaroof/probe-answer";
import { chooseSkillsAutonomously } from "@/lib/maaroof/skill-inference";
import { councilEngines, linksOf, stageTimeline } from "@/lib/maaroof/pipeline-cards";
import { TOOL_OPTIONS } from "@/lib/tool-options";

describe("ten-model probe answers", () => {
  it("output budget leaves room for thinking models to write (was 500)", () => {
    expect(PROBE_MAX_TOKENS).toBeGreaterThanOrEqual(1500);
  });
  it("empty reply is not counted as an answer", () => {
    expect(parseProbeContent("")).toBeNull();
    expect(parseProbeContent('{"answer":"","brands":[]}')).toBeNull();
  });
  it("parses fenced JSON with brands and urls", () => {
    const p = parseProbeContent('```json\n{"answer":"Try Maaroof Ai","brands":["Maaroof Ai"],"urls":["https://maaroofai.com"]}\n```');
    expect(p).toEqual({ answer: "Try Maaroof Ai", brands: ["Maaroof Ai"], urls: ["https://maaroofai.com"] });
  });
  it("links only real search results, never invented URLs", () => {
    const p = { answer: "See https://fake.example/x and Webspot", brands: ["Webspot"], urls: ["https://fake.example/x"] };
    const items = [{ url: "https://webspot.com.lb/", title: "Webspot agency Beirut" }, { url: "https://other.com", title: "Other" }];
    expect(linkSources(p, items)).toEqual([{ url: "https://webspot.com.lb/", title: "Webspot agency Beirut" }]);
  });
  it("charges answered engines only: 10 asked, 4 answered, 240 charged → refund 144", () => {
    expect(probeRefund(240, 10, 4)).toBe(144);
    expect(probeRefund(240, 10, 10)).toBe(0);
    expect(probeRefund(240, 10, 0)).toBe(240);
  });
  it("charges and refunds blind/grounded calls as separate units", () => {
    expect(probePhaseRefund(200, 10, 7)).toBe(60);
    expect(probePhaseRefund(200, 10, 10)).toBe(0);
    expect(probePhaseRefund(200, 10, 0)).toBe(200);
  });
  it("blind query uses only service category and market, with no target-brand input", () => {
    const q = blindProbeQuestion("  digital   marketing agencies ", "Beirut");
    expect(q).toContain("digital marketing agencies");
    expect(q).toContain("Beirut");
    expect(q).toContain("without favoring any brand");
  });
  it("background mode is removed from agent visibility input", () => {
    expect(stripAgentOnlyFields("visibility", { brand: "x", background: "some text" } as any)).toEqual({ brand: "x" });
    expect(TOOL_OPTIONS.visibility.fields).not.toContain("background");
  });
});

describe("Maaroof chooses tools by itself", () => {
  it("no keywords but known brand → presence audit, no question", () => {
    const r = chooseSkillsAutonomously("ابدأ", [], { brand: "Maaroof Ai" });
    expect(r.kind).toBe("inferred");
    expect(r.skills).toContain("presence_audit");
  });
  it("unknown brand and no keywords → still asks before charging", () => {
    expect(chooseSkillsAutonomously("ابدأ", [], {}).kind).toBe("clarify");
  });
});

describe("cards show what really happened", () => {
  const ev = [
    { type: "tool_call", data: { tool: "visibility" }, at: 1 },
    { type: "tool_result", data: { tool: "visibility", ok: true, output: { probe: {
      asked: ["chatgpt", "gemini", "claude"],
      statuses: { chatgpt: { status: "answered", ms: 4000 }, gemini: { status: "timeout", ms: 30000 }, claude: { status: "empty", ms: 9000 } },
      evidence: [{ url: "https://a.com", title: "A" }],
      answers: [{ engine: "chatgpt", mentioned: true, rank: 1, answer: "Maaroof", brands: ["Maaroof"], sources: [{ url: "https://a.com", title: "A" }] }],
    } } }, at: 2 },
  ];
  it("per-model real status and reason", () => {
    const r = councilEngines(ev, ["chatgpt", "gemini", "claude"], false);
    expect(r[0]).toMatchObject({ status: "answered", ms: 4000 });
    expect(r[0].sources).toEqual([{ url: "https://a.com", title: "A" }]);
    expect(r[1]).toMatchObject({ status: "unresponsive", miss: "timeout" });
    expect(r[2]).toMatchObject({ status: "unresponsive", miss: "empty" });
  });
  it("evidence timeline carries real links", () => {
    expect(linksOf(ev[1].data.output)).toEqual([{ url: "https://a.com", title: "A" }]);
    const t = stageTimeline(ev as any, "evidence", "ar");
    expect(t.some((x) => x.links.length === 1)).toBe(true);
  });
});
