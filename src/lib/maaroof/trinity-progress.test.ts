import { describe, it, expect } from "vitest";
import { trinityScore } from "./trinity-score";
import { compareProbes } from "./progress";
import { fillToolInput } from "./agent-input";

describe("trinity", () => {
  it("no data -> null scores", () => {
    const t = trinityScore({});
    expect(t.seo.score).toBeNull(); expect(t.aeo.score).toBeNull(); expect(t.geo.score).toBeNull();
  });
  it("measured geo", () => {
    expect(trinityScore({ probe: { mentioned: 5, total: 10 } }).geo.score).toBe(50);
  });
});
describe("progress", () => {
  it("needs two runs", () => expect(compareProbes([{ at: "2026-10-01", mentioned: 2, total: 10 }])).toBeNull());
  it("compares latest two", () => {
    const t = compareProbes([{ at: "2026-10-01", mentioned: 2, total: 10 }, { at: "2026-10-10", mentioned: 5, total: 10 }])!;
    expect(t).toContain("5 من 10"); expect(t).toContain("2 من 10");
  });
});
describe("creator url", () => {
  it("uses social link when no website", () => {
    const o = fillToolInput("analyze", {}, { profile: { entity_type: "creator", entity_links: [{ url: "https://instagram.com/x" }] } });
    expect(o.url).toBe("https://instagram.com/x");
  });
});
