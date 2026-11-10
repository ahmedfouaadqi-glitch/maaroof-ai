import { describe, it, expect } from "vitest";
import { normalizeLang } from "./index";

describe("default language", () => {
  it("falls back to English when no language is given", () => {
    expect(normalizeLang(undefined)).toBe("en");
    expect(normalizeLang("xx")).toBe("en");
  });
  it("keeps Arabic and Kurdish when chosen", () => {
    expect(normalizeLang("ar")).toBe("ar");
    expect(normalizeLang("ku")).toBe("ku");
  });
});
