import { describe, expect, it } from "vitest";
import {
  calculateVisibilityTrialWindow,
  canRetrieveVisibilityTrialResult,
  isVisibilityTrialEligible,
  VISIBILITY_TRIAL_CYCLE_MS,
  VISIBILITY_TRIAL_RESULT_TTL_MS,
} from "./visibility-trial-policy";

describe("visibility trial lifecycle policy", () => {
  const start = new Date("2026-11-13T00:00:00.000Z");

  it("expires the result after 72 hours and re-opens eligibility after 77 hours", () => {
    const window = calculateVisibilityTrialWindow(start);
    expect(window.resultExpiresAt.getTime() - start.getTime()).toBe(VISIBILITY_TRIAL_RESULT_TTL_MS);
    expect(window.nextEligibleAt.getTime() - start.getTime()).toBe(VISIBILITY_TRIAL_CYCLE_MS);
    expect(window.nextEligibleAt.toISOString()).toBe("2026-11-16T05:00:00.000Z");
  });

  it("does not re-open during the five-hour post-expiry cooldown", () => {
    const window = calculateVisibilityTrialWindow(start);
    expect(isVisibilityTrialEligible("2026-11-16T04:59:59.999Z", window.nextEligibleAt)).toBe(false);
    expect(isVisibilityTrialEligible("2026-11-16T05:00:00.000Z", window.nextEligibleAt)).toBe(true);
  });

  it("allows exactly one re-open while the report is still within 72 hours", () => {
    const expiry = calculateVisibilityTrialWindow(start).resultExpiresAt;
    expect(canRetrieveVisibilityTrialResult("2026-11-14T00:00:00.000Z", expiry, 1)).toBe(true);
    expect(canRetrieveVisibilityTrialResult("2026-11-14T00:00:00.000Z", expiry, 2)).toBe(false);
    expect(canRetrieveVisibilityTrialResult(expiry, expiry, 1)).toBe(false);
  });

  it("rejects invalid timestamps", () => {
    expect(() => calculateVisibilityTrialWindow("not-a-date")).toThrow("Invalid trial start time");
    expect(isVisibilityTrialEligible("not-a-date", start)).toBe(false);
  });
});
