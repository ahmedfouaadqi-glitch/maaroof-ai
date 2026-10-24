import { describe, it, expect } from "vitest";
import { resolveMonitorPolicy, checkMonitorPolicy } from "../monitor-policy";

describe("monitor policy", () => {
  it("global limit applies", () => {
    const p = resolveMonitorPolicy({ max_watches: 2 }, null);
    expect(checkMonitorPolicy(p, 2, 1, 24)).toEqual({ ok: false, reason: "monitor_max_watches" });
    expect(checkMonitorPolicy(p, 1, 1, 24).ok).toBe(true);
  });
  it("user override wins", () => {
    const p = resolveMonitorPolicy({ max_watches: 1, enabled: true }, { max_watches: 10, max_competitors: 8 });
    expect(checkMonitorPolicy(p, 5, 8, 24).ok).toBe(true);
    const off = resolveMonitorPolicy({ enabled: true }, { enabled: false });
    expect(checkMonitorPolicy(off, 0, 1, 24)).toEqual({ ok: false, reason: "monitor_disabled" });
  });
  it("frequency and competitor caps", () => {
    const p = resolveMonitorPolicy({ max_competitors: 3, min_frequency_hours: 12 }, null);
    expect(checkMonitorPolicy(p, 0, 4, 24)).toEqual({ ok: false, reason: "monitor_max_competitors" });
    expect(checkMonitorPolicy(p, 0, 2, 6)).toEqual({ ok: false, reason: "monitor_min_frequency" });
  });
});
