import { describe, it, expect } from "vitest";
import { isFresh, requestFingerprint, toolProfile } from "../registry";

describe("MCI registry", () => {
  it("fingerprints identical requests the same regardless of case/spacing", () => {
    expect(requestFingerprint(["Zain  Iraq", "Baghdad", "quick"])).toBe(requestFingerprint(["zain iraq", "baghdad ", "quick"]));
    expect(requestFingerprint(["Zain", "Baghdad", "quick"])).not.toBe(requestFingerprint(["Zain", "Basra", "quick"]));
  });
  it("freshness respects the tool window", () => {
    const now = Date.now();
    expect(isFresh(new Date(now - 3600_000), 24, now)).toBe(true);
    expect(isFresh(new Date(now - 30 * 3600_000), 24, now)).toBe(false);
    expect(isFresh(new Date(now), 0, now)).toBe(false);
  });
  it("known is MCI-enabled by default, others are not", () => {
    expect(toolProfile("known")?.mciEnabled).toBe(true);
    expect(toolProfile("analyze")?.mciEnabled).toBe(true);
  });
});
