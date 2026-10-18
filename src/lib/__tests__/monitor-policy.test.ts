import { describe, it, expect } from "vitest";
import { resolveMonitorPolicy, checkMonitorPolicy, resolveMonitorQuota } from "../monitor-policy";

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


describe("monitor monthly quota", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");

  it("enforces the active subscriber cap", () => {
    const q = resolveMonitorQuota({
      monthly_analyses_used: 99,
      is_subscribed: true,
      subscription_expires_at: "2026-11-01T00:00:00.000Z",
    }, 2, now);
    expect(q).toMatchObject({ used: 99, limit: 100, subscriptionActive: true, allowed: false, error: "monthly_cap_reached" });
  });

  it("allows an active subscriber below the cap", () => {
    const q = resolveMonitorQuota({
      monthly_analyses_used: 98,
      is_subscribed: true,
      subscription_expires_at: "2026-11-01T00:00:00.000Z",
    }, 2, now);
    expect(q).toMatchObject({ used: 98, limit: 100, subscriptionActive: true, allowed: true, error: null });
  });

  it("treats an expired subscription as inactive", () => {
    const q = resolveMonitorQuota({
      monthly_analyses_used: 4,
      is_subscribed: true,
      subscription_expires_at: "2026-10-01T00:00:00.000Z",
    }, 2, now);
    expect(q).toMatchObject({ limit: 5, subscriptionActive: false, allowed: false, error: "subscription_required" });
  });

  it("honors a monthly quota override", () => {
    const q = resolveMonitorQuota({
      monthly_analyses_used: 8,
      is_subscribed: false,
      quota_overrides: { monthly_analyses: 10 },
    }, 2, now);
    expect(q).toMatchObject({ limit: 10, allowed: true, error: null });
  });
});
