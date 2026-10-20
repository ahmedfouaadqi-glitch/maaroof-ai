import { describe, it, expect } from "vitest";
import { isPlaceholderName, phaseLabel, isIntentionalSkip, summarizeToolOutput, taskWeight } from "./event-labels";

describe("event labels", () => {
  it("translates phases to Arabic", () => {
    expect(phaseLabel("conflict_resolution", "ar")).toBe("حل التعارض");
    expect(phaseLabel("council", "ar")).toBe("المجلس");
  });
  it("treats a disabled live check as a skip, not a failure", () => {
    expect(isIntentionalSkip({ ok: false, error: "live_probe_disabled_by_user" })).toBe(true);
    expect(isIntentionalSkip({ ok: false, error: "timeout" })).toBe(false);
  });
  it("summarizes a compare result instead of a generic label", () => {
    expect(summarizeToolOutput({ brands: [{ name: "A" }, { name: "B" }] }, "ar")).toBe("قورنت 2 علامات: A، B");
  });
  it("weights tasks by steps × engines", () => {
    expect(taskWeight(1, 10)).toBe("light");
    expect(taskWeight(3, 10)).toBe("medium");
    expect(taskWeight(10, 10)).toBe("deep");
  });
  it("rejects filler competitor names but keeps real ones", () => {
    expect(isPlaceholderName("Competitor 1")).toBe(true);
    expect(isPlaceholderName("{{known.result}}")).toBe(true);
    expect(isPlaceholderName("Zain Iraq")).toBe(false);
  });
});
