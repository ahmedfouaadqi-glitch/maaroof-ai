import { describe, expect, it } from "vitest";
import {
  aggregateRevenue,
  classifyGa4Row,
  mapGa4ReportRow,
  normalizeExternalTrafficRecord,
  normalizeTrafficBatch,
} from "./adapters";
import { buildAttributionProjection } from "./projection";

const workspaceId = "11111111-1111-4111-8111-111111111111";

function event(overrides: Record<string, unknown> = {}) {
  return {
    provider: "first_party",
    externalId: "evt-1",
    occurredAt: "2026-02-01T10:00:00.000Z",
    workspaceId,
    sessionId: "session-1",
    eventName: "page_view",
    source: "chatgpt.com",
    medium: "referral",
    consent: "granted",
    ...overrides,
  };
}

describe("normalizeExternalTrafficRecord", () => {
  it("normalizes an explicitly consented event and classifies AI referral", () => {
    const result = normalizeExternalTrafficRecord(event());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.classification.channel).toBe("ai_referral");
      expect(result.data.event.workspaceId).toBe(workspaceId);
      expect(result.data.event.eventId).toBe("first_party:evt-1");
    }
  });

  it("rejects event-level ingestion without granted consent", () => {
    const result = normalizeExternalTrafficRecord(event({ consent: "unknown" }));
    expect(result.success).toBe(false);
  });

  it("rejects invalid currency codes", () => {
    const result = normalizeExternalTrafficRecord(event({ conversionValue: 10, currency: "US" }));
    expect(result.success).toBe(false);
  });
});

describe("normalizeTrafficBatch", () => {
  it("deduplicates external IDs per provider and preserves separate providers", () => {
    const result = normalizeTrafficBatch([
      event(),
      event(),
      event({ provider: "manual" }),
    ]);
    expect(result.accepted).toHaveLength(2);
    expect(result.duplicateExternalIds).toEqual(["first_party:evt-1"]);
  });
});

describe("GA4 mapping", () => {
  it("maps aggregate GA4 dimensions and metrics without inventing event rows", () => {
    const row = mapGa4ReportRow({
      dimensionValues: [
        { value: "chatgpt.com" },
        { value: "referral" },
        { value: "(not set)" },
        { value: "https://chatgpt.com/" },
        { value: "/pricing" },
      ],
      metricValues: [{ value: "12" }, { value: "2" }, { value: "125.50" }],
    });
    expect(row?.sessions).toBe(12);
    expect(row?.keyEvents).toBe(2);
    expect(row?.totalRevenue).toBe(125.5);
    expect(row && classifyGa4Row(row).channel).toBe("ai_referral");
  });

  it("rejects negative or fractional GA4 count metrics", () => {
    const row = {
      dimensionValues: Array.from({ length: 5 }, () => ({ value: "x" })),
      metricValues: [{ value: "-1" }, { value: "1" }, { value: "0" }],
    };
    expect(mapGa4ReportRow(row)).toBeNull();
    expect(mapGa4ReportRow({
      ...row,
      metricValues: [{ value: "1.5" }, { value: "1" }, { value: "0" }],
    })).toBeNull();
  });

  it("rejects incomplete or non-numeric GA4 rows", () => {
    expect(mapGa4ReportRow({ dimensionValues: [], metricValues: [] })).toBeNull();
  });
});

describe("aggregateRevenue", () => {
  const conversion = {
    conversionId: "order-1",
    workspaceId,
    occurredAt: "2026-02-02T10:00:00.000Z",
    sourceEventIds: ["first_party:evt-1"],
    value: 100,
    currency: "USD",
    status: "confirmed",
  };

  it("keeps currencies separate and prevents duplicate conversion counting", () => {
    const result = aggregateRevenue([
      conversion,
      conversion,
      { ...conversion, conversionId: "order-2", currency: "IQD", value: 150000 },
    ]);
    expect(result.summaries).toHaveLength(2);
    expect(result.duplicateConversionIds).toEqual([workspaceId + ":order-1"]);
  });

  it("respects currency fraction digits and rejects unsupported precision", () => {
    const result = aggregateRevenue([
      { ...conversion, conversionId: "yen-valid", currency: "JPY", value: 100 },
      { ...conversion, conversionId: "yen-invalid", currency: "JPY", value: 100.5 },
      { ...conversion, conversionId: "usd-invalid", currency: "USD", value: 1.001 },
      { ...conversion, conversionId: "currency-invalid", currency: "ZZZ", value: 10 },
    ]);
    expect(result.summaries.find((item) => item.currency === "JPY")?.confirmedRevenue).toBe(100);
    expect(result.rejected).toHaveLength(3);
  });

  it("does not add pending or reversed revenue to confirmed revenue", () => {
    const result = aggregateRevenue([
      conversion,
      { ...conversion, conversionId: "order-2", status: "pending" },
      { ...conversion, conversionId: "order-3", status: "reversed" },
    ]);
    expect(result.summaries[0].confirmedRevenue).toBe(100);
    expect(result.summaries[0].pendingConversions).toBe(1);
    expect(result.summaries[0].pendingRevenue).toBe(100);
    expect(result.summaries[0].reversedConversions).toBe(1);
    expect(result.summaries[0].reversedRevenue).toBe(100);
    expect(result.summaries[0].confirmedRevenue).toBe(100);
  });
});

describe("buildAttributionProjection", () => {
  it("scopes events and conversions to one workspace and keeps AI referral separate", () => {
    const first = normalizeExternalTrafficRecord(event());
    const sameWorkspaceOtherJourney = normalizeExternalTrafficRecord(event({
      externalId: "unrelated-session-event",
      sessionId: "session-2",
      source: "linkedin",
      medium: "social",
    }));
    const other = normalizeExternalTrafficRecord(event({
      externalId: "other",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      source: "linkedin",
      medium: "social",
    }));
    expect(first.success && sameWorkspaceOtherJourney.success && other.success).toBe(true);
    if (!first.success || !sameWorkspaceOtherJourney.success || !other.success) return;

    const projection = buildAttributionProjection({
      workspaceId,
      model: "last_touch",
      traffic: [first.data, sameWorkspaceOtherJourney.data, other.data],
      conversions: [{
        conversionId: "order-1",
        workspaceId,
        occurredAt: "2026-02-02T10:00:00.000Z",
        sourceEventIds: ["first_party:evt-1"],
        value: 100,
        currency: "USD",
        status: "confirmed",
      }],
    });
    expect(projection.counts.acceptedTrafficEvents).toBe(2);
    expect(projection.counts.aiReferralEvents).toBe(1);
    expect(projection.channelAttribution[0].channel).toBe("ai_referral");
    expect(projection.channelAttribution[0].attributedRevenue).toBe(100);
  });

  it("keeps pending and reversed conversions out of confirmed attribution", () => {
    const projection = buildAttributionProjection({
      workspaceId,
      model: "last_touch",
      traffic: [],
      conversions: [
        {
          conversionId: "pending-1",
          workspaceId,
          occurredAt: "2026-02-02T10:00:00.000Z",
          sourceEventIds: [],
          value: 20,
          currency: "USD",
          status: "pending",
        },
        {
          conversionId: "reversed-1",
          workspaceId,
          occurredAt: "2026-02-02T10:00:00.000Z",
          sourceEventIds: [],
          value: 30,
          currency: "USD",
          status: "reversed",
        },
      ],
    });
    expect(projection.counts.confirmedConversions).toBe(0);
    expect(projection.counts.pendingConversions).toBe(1);
    expect(projection.counts.reversedConversions).toBe(1);
    expect(projection.counts.unattributedConversions).toBe(0);
    expect(projection.channelAttribution).toHaveLength(0);
  });

  it("rejects malformed workspace IDs before building a report", () => {
    expect(() => buildAttributionProjection({
      workspaceId: "not-a-workspace",
      model: "last_touch",
      traffic: [],
      conversions: [],
    })).toThrow("invalid_attribution_workspace_id");
  });

  it("does not claim sessions and reports missing source limitations", () => {
    const projection = buildAttributionProjection({
      workspaceId,
      model: "last_touch",
      traffic: [],
      conversions: [],
    });
    expect(projection.measurementStatus).toBe("unknown");
    expect(projection.limitations.some((item) => item.includes("not session counts"))).toBe(true);
  });
});
