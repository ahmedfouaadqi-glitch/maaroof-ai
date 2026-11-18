import { describe, expect, it } from "vitest";
import { toAttributionExportSections } from "./export-projection";
import type { AttributionProjection } from "./projection";

const projection: AttributionProjection = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  model: "last_non_direct",
  generatedAt: "2026-02-03T10:00:00.000Z",
  measurementStatus: "partial",
  counts: {
    acceptedTrafficEvents: 12,
    duplicateTrafficEventsExcluded: 0,
    nonCrawlerSessions: 8,
    aiReferralSessions: 2,
    crawlerSessions: 1,
    eventsWithoutSessionId: 2,
    aiReferralEvents: 3,
    crawlerMarkerEvents: 2,
    confirmedConversions: 4,
    unattributedConversions: 1,
  },
  channelAttribution: [{
    channel: "ai_referral",
    source: "chatgpt.com",
    conversionCredit: 1.5,
    attributedRevenue: 125.5,
    currency: "USD",
  }],
  limitations: ["Traffic event counts are not session counts."],
};

describe("toAttributionExportSections", () => {
  it("builds three report sections without mutating the source projection", () => {
    const sections = toAttributionExportSections(projection, "en");
    expect(sections).toHaveLength(3);
    expect(sections[0].rows).toContainEqual(["Recorded AI referrals", 3]);
    expect(sections[1].table?.data[0]).toEqual(["ai_referral", "chatgpt.com", 1.5, 125.5, "USD"]);
    expect(sections[2].list).toEqual(projection.limitations);
    expect(projection.channelAttribution[0].conversionCredit).toBe(1.5);
  });

  it("localizes headings and status labels to Arabic", () => {
    const sections = toAttributionExportSections(projection, "ar");
    expect(sections[0].heading).toBe("ملخص الإسناد");
    expect(sections[0].rows?.[0]).toEqual(["حالة القياس", "جزئي"]);
  });
});
