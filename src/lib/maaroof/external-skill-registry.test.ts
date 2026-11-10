import { describe, expect, it } from "vitest";
import {
  EXTERNAL_SKILL_PACKAGES,
  EXTERNAL_SKILL_REGISTRY_STATS,
  getExternalSkillVariants,
  validateExternalSkillRegistry,
} from "./external-skill-registry";

describe("external skill package registry", () => {
  it("preserves the audited corpus counts", () => {
    expect(EXTERNAL_SKILL_REGISTRY_STATS.sourceArchives).toBe(80);
    expect(EXTERNAL_SKILL_REGISTRY_STATS.exactDuplicateArchives).toBe(10);
    expect(EXTERNAL_SKILL_PACKAGES).toHaveLength(70);
    expect(EXTERNAL_SKILL_REGISTRY_STATS.uniqueSkillNames).toBe(69);
  });

  it("contains unique package ids and SHA-256 source digests", () => {
    expect(validateExternalSkillRegistry()).toEqual([]);
  });

  it("preserves both Humanizer source variants without merging their identity", () => {
    const variants = getExternalSkillVariants("humanizer");
    expect(variants).toHaveLength(2);
    expect(variants.map((item) => item.version).sort()).toEqual(["2.1.1", "3.1.0"]);
    expect(variants.find((item) => item.version === "3.1.0")?.variantDisposition).toBe("preferred_candidate");
    expect(variants.find((item) => item.version === "2.1.1")?.variantDisposition).toBe("alternate_candidate");
    expect(new Set(variants.map((item) => item.source.sha256)).size).toBe(2);
  });

  it("keeps every imported package inactive and non-executable", () => {
    for (const item of EXTERNAL_SKILL_PACKAGES) {
      expect(item.governance.lifecycle).toBe("candidate");
      expect(item.governance.loadMode).toBe("reference_only");
      expect(item.governance.executionAllowed).toBe(false);
    }
  });

  it("does not bind competitor intelligence to the paused monitoring tool", () => {
    const item = getExternalSkillVariants("competitive-intelligence")[0];
    expect(item.capabilityBindings.map((binding) => binding.targetId)).toEqual([
      "known",
      "compare",
      "keyword_intelligence",
    ]);
    expect(item.capabilityBindings.some((binding) => binding.targetId === "competitor_monitor")).toBe(false);
  });

  it("returns no variants for an unknown skill", () => {
    expect(getExternalSkillVariants("not-a-real-skill")).toEqual([]);
  });
});
