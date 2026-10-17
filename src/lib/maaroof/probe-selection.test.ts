import { describe, expect, it } from "vitest";
import { affordableProbeEngineCount } from "./probe-selection";

const base = {
  eligibleCount: 9,
  hasMeter: true,
  balance: 100,
  dailyLimit: null,
  monthlyLimit: null,
  usedToday: 0,
  usedMonth: 0,
  tokensPerEngine: 25,
  priced: true,
  disabled: false,
};

describe("affordableProbeEngineCount", () => {
  it("returns zero when no balance is available", () => {
    expect(affordableProbeEngineCount({ ...base, balance: 0 })).toBe(0);
  });

  it("allows only the number of engines covered by balance", () => {
    expect(affordableProbeEngineCount({ ...base, balance: 25 })).toBe(1);
    expect(affordableProbeEngineCount({ ...base, balance: 74 })).toBe(2);
  });

  it("honors daily and monthly remaining limits", () => {
    expect(affordableProbeEngineCount({ ...base, balance: 500, dailyLimit: 50, usedToday: 25 })).toBe(1);
    expect(affordableProbeEngineCount({ ...base, balance: 500, monthlyLimit: 75, usedMonth: 25 })).toBe(2);
  });

  it("honors the eligible plan/admin cap", () => {
    expect(affordableProbeEngineCount({ ...base, eligibleCount: 3, balance: 500 })).toBe(3);
    expect(affordableProbeEngineCount({ ...base, eligibleCount: 0, balance: 500 })).toBe(0);
  });

  it("returns zero for unpriced or disabled metered probes", () => {
    expect(affordableProbeEngineCount({ ...base, priced: false, balance: 500 })).toBe(0);
    expect(affordableProbeEngineCount({ ...base, disabled: true, balance: 500 })).toBe(0);
  });

  it("keeps the legacy unmetered path independent of token balance", () => {
    expect(affordableProbeEngineCount({ ...base, hasMeter: false, balance: 0 })).toBe(9);
  });

  it("fails closed on invalid per-engine pricing", () => {
    expect(affordableProbeEngineCount({ ...base, tokensPerEngine: 0 })).toBe(0);
    expect(affordableProbeEngineCount({ ...base, tokensPerEngine: Number.NaN })).toBe(0);
  });
});
