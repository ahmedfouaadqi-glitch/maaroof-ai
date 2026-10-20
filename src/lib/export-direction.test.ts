import { describe, it, expect } from "vitest";
import { textIsRtl } from "./exports";

describe("export text direction", () => {
  it("Arabic text is right-to-left even in an English report", () => {
    expect(textIsRtl("تقرير الظهور", false)).toBe(true);
  });
  it("English text is left-to-right even in an Arabic report", () => {
    expect(textIsRtl("Visibility report", true)).toBe(false);
  });
  it("numbers only follow the report language", () => {
    expect(textIsRtl("2026", true)).toBe(true);
  });
});
