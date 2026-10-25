import { describe, expect, it } from "vitest";
import { computeFloatingMenuPosition } from "./floating-menu";

describe("computeFloatingMenuPosition", () => {
  it("opens above the trigger when there is not enough room below", () => {
    const result = computeFloatingMenuPosition(
      { top: 650, right: 300, bottom: 680, left: 220 },
      { width: 288, height: 260 },
      { width: 390, height: 720 },
      "rtl",
    );
    expect(result.side).toBe("above");
    expect(result.top).toBe(378);
    expect(result.left).toBe(12);
  });

  it("keeps the menu inside both horizontal viewport edges", () => {
    const left = computeFloatingMenuPosition(
      { top: 100, right: 388, bottom: 128, left: 330 },
      { width: 320, height: 240 },
      { width: 390, height: 720 },
      "ltr",
    );
    expect(left.left).toBe(58);

    const right = computeFloatingMenuPosition(
      { top: 100, right: 388, bottom: 128, left: 330 },
      { width: 320, height: 240 },
      { width: 390, height: 720 },
      "rtl",
    );
    expect(right.left).toBe(58);
  });

  it("opens below when there is enough room", () => {
    const result = computeFloatingMenuPosition(
      { top: 100, right: 160, bottom: 128, left: 80 },
      { width: 260, height: 180 },
      { width: 1024, height: 768 },
      "ltr",
    );
    expect(result.side).toBe("below");
    expect(result.top).toBe(136);
    expect(result.left).toBe(80);
  });
});
