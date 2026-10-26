import { describe, it, expect } from "vitest";
import { inferSkills, executableToolsFor } from "./skill-inference";

describe("inferSkills", () => {
  it("keeps user-selected skills", () => {
    expect(inferSkills("anything", ["presence_audit"]).skills).toEqual(["presence_audit"]);
  });
  it("asks instead of guessing when no evidence", () => {
    expect(inferSkills("مرحبا").kind).toBe("clarify");
  });
  it("a URL in the goal picks entity readiness with the URL as reason", () => {
    const r = inferSkills("راجع https://maaroofai.com");
    expect(r.skills).toContain("entity_readiness");
    expect(r.reasons.entity_readiness).toContain("maaroofai.com");
  });
  it("maps internal skills to executable steps", () => {
    expect(executableToolsFor(["localization"])).toEqual(["translate"]);
    expect(executableToolsFor(["knowledge_training"])).toEqual(["teach_space"]);
    expect(executableToolsFor(["presence_audit"])).toEqual(["known", "visibility"]);
  });
  it("keeps competitor analysis available without exposing paused monitoring", () => {
    expect(executableToolsFor(["smart_competitor"])).toEqual(["compare"]);
    expect(executableToolsFor(["competitor_gap"])).toEqual(["compare"]);
  });
});
