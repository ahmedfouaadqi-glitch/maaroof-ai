import { describe, it, expect } from "vitest";
import { tone } from "./WorkspaceAuditPulse";

describe("audit score tone", () => {
  it("mid scores (40-69) use the warning color", () => {
    expect(tone(40)).toContain("text-warning");
    expect(tone(69)).toContain("text-warning");
  });
  it("70+ is primary, below 40 destructive", () => {
    expect(tone(70)).toContain("text-primary");
    expect(tone(39)).toContain("text-destructive");
  });
});
