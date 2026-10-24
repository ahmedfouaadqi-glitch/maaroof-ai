import { describe, it, expect } from "vitest";
import { parseTimeframe, calendarUnit, realismNote } from "./timeframe";

describe("parseTimeframe", () => {
  it("parses arabic digits and words", () => {
    expect(parseTimeframe("خطة لمدة 5 أشهر")?.unit).toBe("months");
    expect(parseTimeframe("خطة لمدة ٥ أشهر")?.count).toBe(5);
    expect(parseTimeframe("خمسة أشهر")?.count).toBe(5);
    expect(parseTimeframe("خلال أسبوعين")).toMatchObject({ count: 2, unit: "weeks" });
    expect(parseTimeframe("في 48 ساعة")).toMatchObject({ count: 48, unit: "hours" });
  });
  it("parses english", () => {
    expect(parseTimeframe("a 3 month plan")).toMatchObject({ count: 3, unit: "months" });
  });
  it("returns null with no duration", () => {
    expect(parseTimeframe("حسن ظهور علامتي")).toBeNull();
  });
  it("5 months is calendared in weeks (~22), not 12", () => {
    const c = calendarUnit(parseTimeframe("5 أشهر")!);
    expect(c.unit).toBe("weeks");
    expect(c.steps).toBeGreaterThan(12);
    expect(realismNote(parseTimeframe("يومين")!)).toBeTruthy();
  });
});
