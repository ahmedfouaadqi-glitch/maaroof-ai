import { describe, it, expect } from "vitest";
import { runAfterResponse } from "@/lib/request-ctx.server";

describe("runAfterResponse without waitUntil", () => {
  it("keeps the work running instead of dropping it", async () => {
    let ran = false;
    const p = (async () => { ran = true; })();
    expect(runAfterResponse(p)).toBe(true);
    await p;
    expect(ran).toBe(true);
  });
});
