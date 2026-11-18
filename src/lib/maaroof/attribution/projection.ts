import {
  attributeConversion,
  type AttributionModel,
  type Conversion,
  type Touchpoint,
  type TrafficChannel,
} from "./domain";
import { summarizeSessions } from "./sessionization";
import {
  ConversionInputSchema,
  type ConversionInput,
  type NormalizedTrafficRecord,
} from "./adapters";

export type AttributionProjectionInput = {
  workspaceId: string;
  model: AttributionModel;
  traffic: NormalizedTrafficRecord[];
  conversions: unknown[];
};

export type ChannelAttributionRow = {
  channel: TrafficChannel;
  source: string | null;
  conversionCredit: number;
  attributedRevenue: number;
  currency: string;
};

export type AttributionProjection = {
  workspaceId: string;
  model: AttributionModel;
  generatedAt: string;
  measurementStatus: "measured" | "partial" | "unknown";
  counts: {
    acceptedTrafficEvents: number;
    duplicateTrafficEventsExcluded: number;
    humanSessions: number;
    aiReferralSessions: number;
    crawlerSessions: number;
    eventsWithoutSessionId: number;
    aiReferralEvents: number;
    crawlerMarkerEvents: number;
    confirmedConversions: number;
    unattributedConversions: number;
  };
  channelAttribution: ChannelAttributionRow[];
  limitations: string[];
};

type Bucket = {
  channel: TrafficChannel;
  source: string | null;
  conversionCredit: number;
  attributedRevenue: number;
  currency: string;
};

/**
 * Creates a report-ready projection from already normalized inputs.
 * It does not claim sessions from event counts, does not infer causality,
 * and keeps revenue buckets separate by currency.
 */
export function buildAttributionProjection(
  input: AttributionProjectionInput,
): AttributionProjection {
  const scopedTraffic = input.traffic.filter(
    (item) => item.event.workspaceId === input.workspaceId,
  );
  const traffic: NormalizedTrafficRecord[] = [];
  const seenEventIds = new Set<string>();
  let duplicateTrafficEventsExcluded = 0;
  const limitations: string[] = [];

  for (const item of scopedTraffic) {
    if (seenEventIds.has(item.event.eventId)) {
      duplicateTrafficEventsExcluded += 1;
      continue;
    }
    seenEventIds.add(item.event.eventId);
    traffic.push(item);
  }
  if (duplicateTrafficEventsExcluded > 0) {
    limitations.push("Duplicate traffic event IDs were excluded.");
  }

  const parsedConversions: ConversionInput[] = [];
  const seenConversions = new Set<string>();

  for (const raw of input.conversions) {
    const parsed = ConversionInputSchema.safeParse(raw);
    if (!parsed.success) {
      limitations.push("One or more conversion records were invalid and excluded.");
      continue;
    }
    if (parsed.data.workspaceId !== input.workspaceId) continue;

    const key = parsed.data.workspaceId + ":" + parsed.data.conversionId;
    if (seenConversions.has(key)) {
      limitations.push("Duplicate conversion identifiers were excluded.");
      continue;
    }
    seenConversions.add(key);
    parsedConversions.push(parsed.data);
  }

  const touchpoints: Touchpoint[] = traffic.map((item) => ({
    eventId: item.event.eventId,
    workspaceId: item.event.workspaceId,
    occurredAt: item.event.occurredAt,
    channel: item.classification.channel,
    source: item.classification.source,
  }));

  const buckets = new Map<string, Bucket>();
  let confirmedConversions = 0;
  let unattributedConversions = 0;

  for (const conversion of parsedConversions) {
    if (conversion.status !== "confirmed") continue;
    confirmedConversions += 1;

    const result = attributeConversion(
      {
        conversionId: conversion.conversionId,
        workspaceId: conversion.workspaceId,
        occurredAt: conversion.occurredAt,
        value: conversion.value,
        currency: conversion.currency,
      } satisfies Conversion,
      touchpoints,
      input.model,
      { eligibleEventIds: conversion.sourceEventIds },
    );

    if (result.unattributed) {
      unattributedConversions += 1;
      continue;
    }

    for (const credit of result.credits) {
      const key = [credit.channel, credit.source || "(not-set)", conversion.currency].join("|");
      const bucket = buckets.get(key) || {
        channel: credit.channel,
        source: credit.source,
        conversionCredit: 0,
        attributedRevenue: 0,
        currency: conversion.currency,
      };
      bucket.conversionCredit += credit.credit;
      bucket.attributedRevenue += conversion.value * credit.credit;
      buckets.set(key, bucket);
    }
  }

  const sessions = summarizeSessions(traffic, input.workspaceId);
  const aiReferralEvents = traffic.filter((item) => item.classification.channel === "ai_referral").length;
  const crawlerMarkerEvents = traffic.filter((item) => item.classification.channel === "crawler").length;
  const measurementStatus = traffic.length === 0
    ? "unknown"
    : limitations.length > 0 || unattributedConversions > 0 || sessions.eventsWithoutSessionId > 0
      ? "partial"
      : "measured";

  if (traffic.length === 0) limitations.push("No eligible traffic events were supplied for this workspace.");
  limitations.push(...sessions.limitations);
  limitations.push("Attribution is descriptive credit allocation, not causal proof of incremental lift.");
  limitations.push("AI referral detection is limited to explicit UTM or recognized referrer evidence; stripped referrers remain unidentifiable.");
  limitations.push("Revenue is reported in source currency; no foreign-exchange conversion is performed.");

  return {
    workspaceId: input.workspaceId,
    model: input.model,
    generatedAt: new Date().toISOString(),
    measurementStatus,
    counts: {
      acceptedTrafficEvents: traffic.length,
      duplicateTrafficEventsExcluded,
      humanSessions: sessions.humanSessions,
      aiReferralSessions: sessions.aiReferralSessions,
      crawlerSessions: sessions.crawlerSessions,
      eventsWithoutSessionId: sessions.eventsWithoutSessionId,
      aiReferralEvents,
      crawlerMarkerEvents,
      confirmedConversions,
      unattributedConversions,
    },
    channelAttribution: [...buckets.values()].map((bucket) => ({
      channel: bucket.channel,
      source: bucket.source,
      conversionCredit: bucket.conversionCredit,
      attributedRevenue: bucket.attributedRevenue,
      currency: bucket.currency,
    })),
    limitations: [...new Set(limitations)],
  };
}
