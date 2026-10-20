import { describe, it, expect } from "vitest";
import { visibleSkillKeys, truthCardCompleteness } from "./landing-data";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";

describe("visibleSkillKeys", () => {
  it("shows all skills when admin has not restricted", () => {
    expect(visibleSkillKeys({}).length).toBe(MAAROOF_SKILLS.length);
  });
  it("hides skills the admin disabled", () => {
    const k = MAAROOF_SKILLS[0].key;
    expect(visibleSkillKeys({ skill_access: { [k]: "disabled" } })).not.toContain(k);
  });
  it("only shows skills in enabled_skills", () => {
    const k = MAAROOF_SKILLS[1].key;
    expect(visibleSkillKeys({ enabled_skills: [k] })).toEqual([k]);
  });
});

describe("truthCardCompleteness", () => {
  it("is 100 when every field is filled", () => {
    expect(truthCardCompleteness({ name: "x", entity_type: "organization", hq_country: "IQ", website: "a.com", links_count: 2, markets_count: 1 })).toBe(100);
  });
  it("is 50 when half is filled", () => {
    expect(truthCardCompleteness({ name: "x", entity_type: "organization", hq_country: "IQ", website: null, links_count: 0, markets_count: 0 })).toBe(50);
  });
});
