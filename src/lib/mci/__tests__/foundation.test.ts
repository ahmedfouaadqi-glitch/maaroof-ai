import { describe, it, expect } from "vitest";
import { resolveCanonicalEntity } from "../canonical-entity";
import { computeContextBudget } from "../context-budget";
import { passesFreshness, requiresLiveData } from "../freshness-gate";
import { evidenceGate, resolveFailureStrategy } from "../evidence-gate";
import { selectContext } from "../context-selector";

describe("MCI foundation", () => {
  it("separates fingerprint from entity key", () => {
    const a = resolveCanonicalEntity("Zain", "IQ", "brand", ["deep"]);
    const b = resolveCanonicalEntity("zain.com", "IQ", "brand", ["fast"]);
    expect(a.entityKey).toBe("iq:brand:zain");
    expect(b.entityKey).toBe(a.entityKey);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
  it("budget scales and respects model window", () => {
    expect(computeContextBudget({ stage: "understanding" })).toBe(1200);
    expect(computeContextBudget({ stage: "reality", complexity: "high", risk: "high" })).toBeGreaterThan(2000);
    expect(computeContextBudget({ stage: "reality", modelContextWindow: 2000 })).toBe(500);
    expect(computeContextBudget({ stage: "reality", modelContextWindow: 500 })).toBe(125);
  });
  it("freshness gate", () => {
    const old = new Date(Date.now() - 48 * 3600_000);
    expect(passesFreshness(old, "live")).toBe(false);
    expect(passesFreshness(old, "competitive")).toBe(true);
    expect(requiresLiveData("ما أسعار اليوم")).toBe(true);
    expect(passesFreshness(new Date(), "structural", "latest news")).toBe(false);
    expect(passesFreshness(new Date(Date.now() + 3600_000), "competitive")).toBe(false);
  });
  it("evidence gate and failure strategy", () => {
    const base = { id: "1", source: "evidence" as const, content: "x", createdAt: "" };
    expect(evidenceGate([{ ...base, claimType: "verified_fact", reliability: 0.9 }]).needWeb).toBe(false);
    expect(evidenceGate([{ ...base, claimType: "contested" }]).needWeb).toBe(true);
    expect(resolveFailureStrategy("verification")).toBe("fail_safe_block");
    expect(resolveFailureStrategy("perception")).toBe("fail_open_with_fallback");
    expect(resolveFailureStrategy("planning", "high")).toBe("fail_safe_block");
  });
  it("selector fits budget with provenance", () => {
    const mk = (id: string, c: any, n: number) => ({ id, source: "knowledge" as const, claimType: c, content: "a".repeat(n * 4), createdAt: "" });
    const r = selectContext([mk("o", "opinion", 100), mk("v", "verified_fact", 100), mk("f", "fact", 100)], "understanding", 200);
    expect(r.selected.map((s) => s.id)).toEqual(["v", "f"]);
    expect(r.provenance.summary().excluded).toBe(1);
  });
  it("rejects invalid reliability and token metadata", () => {
    const base = { source: "knowledge" as const, claimType: "fact" as const, content: "valid", createdAt: "" };
    const r = selectContext([
      { ...base, id: "bad-reliability", reliability: 1.5 },
      { ...base, id: "nan-reliability", reliability: Number.NaN },
      { ...base, id: "negative-tokens", tokens: -2 },
      { ...base, id: "infinite-tokens", tokens: Number.POSITIVE_INFINITY },
      { ...base, id: "valid", reliability: 0.7, tokens: 2 },
    ], "understanding", 10);
    expect(r.selected.map((item) => item.id)).toEqual(["valid"]);
    expect(r.provenance.entries.filter((entry) => !entry.included).map((entry) => entry.reason))
      .toEqual(["invalid_reliability", "invalid_reliability", "invalid_token_count", "invalid_token_count"]);
  });
});
