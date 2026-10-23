import { describe, it, expect } from "vitest";
import { remainingCost } from "@/lib/maaroof/jobs";

describe("resume remaining cost", () => {
  it("charges only tools not reused", () => {
    const r = remainingCost(["known", "visibility", "analyze"], ["known"], { known: 5, visibility: 20, analyze: 10 });
    expect(r.tools).toEqual(["visibility", "analyze"]);
    expect(r.tokens).toBe(30);
  });
  it("is zero when everything is reused", () => {
    expect(remainingCost(["known"], ["known"], { known: 5 }).tokens).toBe(0);
  });
});
