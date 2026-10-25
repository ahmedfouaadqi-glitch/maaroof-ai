import { describe, it, expect } from "vitest";
import { benchmarkDisplaySubject, benchmarkStorageSubject, scoreAgainstBaseline } from "./benchmark.server";

describe("benchmark identity and comparability", () => {
  it("separates users and workspaces while keeping display labels clean", () => {
    const a = benchmarkStorageSubject("Maaroof", "user-a", "workspace-a");
    const b = benchmarkStorageSubject("Maaroof", "user-b", "workspace-a");
    const c = benchmarkStorageSubject("Maaroof", "user-a", "workspace-b");
    expect(new Set([a, b, c]).size).toBe(3);
    expect(benchmarkDisplaySubject(a)).toBe("Maaroof");
  });

  it("does not manufacture a baseline comparison when none exists", () => {
    expect(scoreAgainstBaseline(90, null)).toEqual({ delta: null, passed: null, improvement: 0 });
  });

  it("respects metrics where lower is better", () => {
    expect(scoreAgainstBaseline(2, 5, false)).toEqual({ delta: -3, passed: true, improvement: 60 });
  });
});
