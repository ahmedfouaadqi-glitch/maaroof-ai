import { describe, expect, it } from "vitest";
import {
  isValidReportEmail,
  nextBrandBoostRunAt,
  previousCalendarMonth,
  shouldSendMonthlyBrandReport,
} from "../brand-boost-automation";

describe("Brand Boost automation cadence", () => {
  const start = new Date("2026-10-30T12:00:00.000Z");

  it("runs weekly cadence twice per seven days", () => {
    expect(nextBrandBoostRunAt("weekly", start).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });

  it("runs daily cadence after 24 hours", () => {
    expect(nextBrandBoostRunAt("daily", start).toISOString()).toBe("2026-10-31T12:00:00.000Z");
  });

  it("clamps monthly cadence to the last day of shorter months", () => {
    expect(nextBrandBoostRunAt("monthly", new Date("2026-01-31T09:15:00.000Z")).toISOString())
      .toBe("2026-02-28T09:15:00.000Z");
  });

  it("reports the previous complete UTC calendar month", () => {
    expect(previousCalendarMonth(new Date("2026-10-01T00:00:00.000Z"))).toEqual({
      month: "2026-09",
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-10-01T00:00:00.000Z",
    });
  });

  it("sends monthly reports only on the first UTC day of a month", () => {
    expect(shouldSendMonthlyBrandReport(new Date("2026-10-01T10:00:00.000Z"))).toBe(true);
    expect(shouldSendMonthlyBrandReport(new Date("2026-10-02T10:00:00.000Z"))).toBe(false);
  });

  it("validates report email addresses conservatively", () => {
    expect(isValidReportEmail("reports@example.com")).toBe(true);
    expect(isValidReportEmail("bad-email")).toBe(false);
    expect(isValidReportEmail("a@b")).toBe(false);
  });
});
