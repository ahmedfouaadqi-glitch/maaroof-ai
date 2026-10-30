import { describe, expect, it } from "vitest";
import {
  ENGINE_CATALOG,
  ENGINE_KEYS,
  ENGINE_LIST,
  engineLimitForPlan,
  enginesForPlan,
  normalizeEngines,
} from "@/lib/ai-engines";

describe("ten-engine catalog contract", () => {
  it("keeps the complete ten-engine catalog in a stable order", () => {
    expect(ENGINE_KEYS).toHaveLength(10);
    expect(new Set(ENGINE_KEYS).size).toBe(10);
    expect(ENGINE_LIST.map((engine) => engine.key)).toEqual([...ENGINE_KEYS]);
    expect(Object.keys(ENGINE_CATALOG)).toEqual([...ENGINE_KEYS]);
  });

  it("does not remove an engine because its integration uses a proxy route", () => {
    const selected = enginesForPlan("MARK 3");
    expect(selected).toHaveLength(10);
    expect(selected).toEqual(expect.arrayContaining([...ENGINE_KEYS]));
    for (const key of ENGINE_KEYS) {
      expect(ENGINE_CATALOG[key]).toHaveProperty("proxy");
      expect(selected).toContain(key);
    }
  });

  it("normalizes all ten keys and removes duplicates only", () => {
    expect(normalizeEngines([...ENGINE_KEYS, "CHATGPT", "invalid"])).toEqual([...ENGINE_KEYS]);
  });

  it("reports ten available engines through the current plan resolver", () => {
    expect(engineLimitForPlan("MARK 1")).toBe(10);
    expect(engineLimitForPlan("MARK 2")).toBe(10);
    expect(engineLimitForPlan("MARK 3")).toBe(10);
  });
});
