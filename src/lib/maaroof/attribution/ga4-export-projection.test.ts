import { describe, expect, it } from "vitest";
import { toGa4AttributionExportSections } from "./ga4-export-projection";
import { projectGa4AttributionRows } from "./ga4-projection";
import type { Ga4RowMapping } from "./adapters";

const rows: Ga4RowMapping[] = [{
  sessionSource: "chatgpt.com",
  sessionMedium: "referral",
  sessionCampaignName: "(not set)",
  pageReferrer: "https://chatgpt.com/",
  landingPage: "/",
  sessions: 8,
  keyEvents: 2,
  totalRevenue: 120,
}];

describe("toGa4AttributionExportSections", () => {
  it("exports GA4 aggregate metrics and limitations without changing source data", () => {
    const projection = projectGa4AttributionRows({ rows, currencyCode: "USD" });
    const sections = toGa4AttributionExportSections(projection, "en");
    expect(sections).toHaveLength(4);
    expect(sections[0].rows).toContainEqual(["AI referral sessions", 8]);
    expect(sections[1].table?.data[0]).toContain("chatgpt.com");
    expect(sections[3].list).toEqual(projection.limitations);
    expect(projection.totalSessions).toBe(8);
  });

  it("localizes the report summary into Arabic", () => {
    const projection = projectGa4AttributionRows({ rows, currencyCode: "USD" });
    const sections = toGa4AttributionExportSections(projection, "ar");
    expect(sections[0].heading).toBe("ملخص GA4 للإحالات");
    expect(sections[0].rows?.[1]).toEqual(["جلسات إحالة AI", 8]);
  });
});
