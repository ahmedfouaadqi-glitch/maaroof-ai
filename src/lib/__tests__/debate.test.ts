import { describe, it, expect } from "vitest";
import { classifyClaim, debateFromOpinions } from "../maaroof/debate";
import { inferSkills } from "../maaroof/skill-inference";

describe("debate", () => {
  it("a claim with a real link is evidence, without is hypothesis", () => {
    expect(classifyClaim("see https://maaroofai.com/about").kind).toBe("evidence");
    expect(classifyClaim("probably weak schema").kind).toBe("hypothesis");
  });
  it("needs at least two opinions", () => {
    expect(debateFromOpinions([{ expert: "a", opinion: "x" }])).toBeNull();
  });
  it("splits agreed vs contested tools and ignores failed experts", () => {
    const d = debateFromOpinions([
      { expert: "a", opinion: "x https://a.com", suggest_tools: ["visibility", "analyze"] },
      { expert: "b", opinion: "y", suggest_tools: ["visibility"], objection: "no data" },
      { expert: "c", error: "timeout" },
    ])!;
    expect(d.experts).toBe(2);
    expect(d.agreedTools).toEqual(["visibility"]);
    expect(d.contestedTools).toEqual(["analyze"]);
    expect(d.evidenceCount).toBe(1);
    expect(d.hypothesisCount).toBe(1);
    expect(d.objections).toHaveLength(1);
  });
});

describe("live skill hints", () => {
  it("text without known words asks instead of guessing", () => {
    expect(inferSkills("مرحبا").kind).toBe("clarify");
  });
  it("a site link alone suggests entity readiness with the link as reason", () => {
    const r = inferSkills("افحص maaroofai.com");
    expect(r.skills).toContain("entity_readiness");
  });
});
