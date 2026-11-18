import { classifyGa4Row, type Ga4RowMapping } from "./adapters";
import type { TrafficChannel } from "./domain";

export type Ga4ChannelSummary = {
  channel: TrafficChannel;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  keyEvents: number;
  totalRevenue: number | null;
  currencyCode: string | null;
};

export type Ga4AttributionProjection = {
  measurementStatus: "measured" | "partial" | "unknown";
  totalSessions: number;
  totalKeyEvents: number;
  totalRevenue: number | null;
  currencyCode: string | null;
  aiReferralSessions: number;
  channels: Ga4ChannelSummary[];
  warnings: string[];
  limitations: string[];
};

/**
 * Summarizes GA4 session-scoped aggregate rows. It does not convert aggregate
 * reports into individual user journeys or apply multi-touch attribution.
 */
export function projectGa4AttributionRows(input: {
  rows: Ga4RowMapping[];
  currencyCode?: string;
  warnings?: string[];
}): Ga4AttributionProjection {
  const groups = new Map<string, Ga4ChannelSummary>();
  let totalSessions = 0;
  let totalKeyEvents = 0;
  let totalRevenue = 0;
  let revenueRows = 0;
  let aiReferralSessions = 0;

  for (const row of input.rows) {
    const classification = classifyGa4Row(row);
    const key = [
      classification.channel,
      classification.source || "(not-set)",
      classification.medium || "(not-set)",
      row.sessionCampaignName || "(not-set)",
      input.currencyCode || "(unknown)",
    ].join("|");

    const group = groups.get(key) || {
      channel: classification.channel,
      source: classification.source,
      medium: classification.medium,
      campaign: row.sessionCampaignName,
      sessions: 0,
      keyEvents: 0,
      totalRevenue: row.totalRevenue == null ? null : 0,
      currencyCode: input.currencyCode || null,
    };

    group.sessions += row.sessions;
    group.keyEvents += row.keyEvents;
    totalSessions += row.sessions;
    totalKeyEvents += row.keyEvents;

    if (row.totalRevenue != null) {
      group.totalRevenue = (group.totalRevenue ?? 0) + row.totalRevenue;
      totalRevenue += row.totalRevenue;
      revenueRows += 1;
    }
    if (classification.channel === "ai_referral") {
      aiReferralSessions += row.sessions;
    }
    groups.set(key, group);
  }

  const warnings = [...(input.warnings || [])];
  if (input.rows.length === 0) warnings.push("The GA4 report returned no rows for the requested dimensions and date range.");

  return {
    measurementStatus: input.rows.length === 0 ? "unknown" : warnings.length > 0 ? "partial" : "measured",
    totalSessions,
    totalKeyEvents,
    totalRevenue: revenueRows > 0 ? totalRevenue : null,
    currencyCode: input.currencyCode || null,
    aiReferralSessions,
    channels: [...groups.values()],
    warnings,
    limitations: [
      "These are GA4 aggregate session-source rows, not individual event records.",
      "GA4 session attribution is reported as supplied by GA4; this projection does not recompute first-touch or multi-touch journeys.",
      "AI referral sessions require a recognized AI source or referrer in the returned GA4 dimensions; stripped or grouped sources may be unavailable.",
      "Key events are GA4-configured events and are not automatically equivalent to qualified leads or closed sales.",
      "Revenue remains in the GA4 property currency; no foreign-exchange conversion is performed.",
    ],
  };
}
