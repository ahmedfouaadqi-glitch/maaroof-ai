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
  it("drops tools without a real route", () => {
    expect(executableToolsFor(["localization"])).toEqual([]);
    expect(executableToolsFor(["presence_audit"])).toEqual(["known", "visibility"]);
  });
});
