import { describe, it, expect } from "vitest";
import { withFallback } from "./tool-council";
describe("council fallback", () => {
  it("uses the gateway when the primary route times out", async () => {
    const r = await withFallback("gemini", async () => ({ engine: "gemini", status: "no_answer", reason: "timeout" }), async () => ({ engine: "gemini", status: "answered", agree: true, score: 70, note: "" }));
    expect(r.status).toBe("answered"); expect(r.via).toBe("gateway");
  });
});
