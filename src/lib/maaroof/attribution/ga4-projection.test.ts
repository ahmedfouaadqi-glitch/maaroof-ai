import { describe, expect, it } from "vitest";
import { projectGa4AttributionRows } from "./ga4-projection";
import type { Ga4RowMapping } from "./adapters";

const rows: Ga4RowMapping[] = [
  {
    sessionSource: "chatgpt.com",
    sessionMedium: "referral",
    sessionCampaignName: "(not set)",
    pageReferrer: "https://chatgpt.com/",
    landingPage: "/home",
    sessions: 10,
    keyEvents: 2,
    totalRevenue: 100,
  },
  {
    sessionSource: "(direct)",
    sessionMedium: "(none)",
    sessionCampaignName: "(not set)",
    pageReferrer: null,
    landingPage: "/pricing",
    sessions: 20,
    keyEvents: 1,
    totalRevenue: 50,
  },
];

describe("projectGa4AttributionRows", () => {
  it("aggregates session-scoped rows and separates AI referrals from Direct", () => {
    const result = projectGa4AttributionRows({ rows, currencyCode: "USD" });
    expect(result.measurementStatus).toBe("measured");
    expect(result.totalSessions).toBe(30);
    expect(result.aiReferralSessions).toBe(10);
    expect(result.totalKeyEvents).toBe(3);
    expect(result.totalRevenue).toBe(150);
    expect(result.channels.find((item) => item.channel === "direct")?.sessions).toBe(20);
  });

  it("does not convert empty GA4 results into zero-traffic certainty", () => {
    const result = projectGa4AttributionRows({ rows: [], currencyCode: "USD" });
    expect(result.measurementStatus).toBe("unknown");
    expect(result.totalRevenue).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("marks partial reports when the GA4 reader supplied warnings", () => {
    const result = projectGa4AttributionRows({ rows, warnings: ["pagination limit reached"] });
    expect(result.measurementStatus).toBe("partial");
  });
});
