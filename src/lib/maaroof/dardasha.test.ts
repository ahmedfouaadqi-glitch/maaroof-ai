import { describe, it, expect } from "vitest";
import { composeChatMessage, canStartTask, AUTO_RUN_OPTIONS } from "./dardasha";

describe("dardasha", () => {
  it("no task starts without explicit approval", () => {
    expect(canStartTask({ approved: false, goal: "فحص علامتي", running: false })).toBe(false);
    expect(canStartTask({ approved: true, goal: "فحص علامتي", running: false })).toBe(true);
    expect(canStartTask({ approved: true, goal: "  ", running: false })).toBe(false);
    expect(canStartTask({ approved: true, goal: "x", running: true })).toBe(false);
  });
  it("attachment analysis is appended as context", () => {
    expect(composeChatMessage("ما هذا؟", [{ name: "a.pdf", analysis: "ملف شركة" }])).toBe("ما هذا؟\n\n[مرفق: a.pdf] ملف شركة");
  });
  it("rescue is automatic", () => { expect(AUTO_RUN_OPTIONS.salvage_on_failure).toBe(true); });
});
