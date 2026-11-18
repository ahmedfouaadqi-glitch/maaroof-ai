import { z } from "zod";
import {
  classifyTrafficSource,
  validateAttributionEvent,
  type AttributionEvent,
  type SourceClassification,
} from "./domain";

/**
 * Adapter boundary contracts. These functions normalize input only; they do
 * not perform network requests, authenticate providers, or persist records.
 */

export const AnalyticsProviderSchema = z.enum([
  "ga4",
  "first_party",
  "crm",
  "manual",
]);
export type AnalyticsProvider = z.infer<typeof AnalyticsProviderSchema>;

export const ExternalTrafficRecordSchema = z.object({
  provider: AnalyticsProviderSchema,
  externalId: z.string().min(1).max(200),
  occurredAt: z.string().datetime(),
  workspaceId: z.string().uuid().nullable(),
  sessionId: z.string().max(160).nullable(),
  eventName: z.string().min(1).max(100),
  source: z.string().max(200).optional(),
  medium: z.string().max(200).optional(),
  campaign: z.string().max(200).optional(),
  referrerUrl: z.string().url().optional(),
  landingUrl: z.string().url().optional(),
  userAgent: z.string().max(2000).optional(),
  consent: z.enum(["granted", "denied", "unknown"]),
  conversionValue: z.number().finite().nonnegative().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict();
export type ExternalTrafficRecord = z.infer<typeof ExternalTrafficRecordSchema>;

export type NormalizedTrafficRecord = {
  provider: AnalyticsProvider;
  externalId: string;
  event: AttributionEvent;
  classification: SourceClassification;
};

export type AdapterIssue = {
  externalId?: string;
  code:
    | "invalid_record"
    | "missing_timestamp"
    | "invalid_currency"
    | "missing_workspace"
    | "consent_not_granted"
    | "unsupported_ga4_shape";
  message: string;
};

export type AdapterBatchResult = {
  accepted: NormalizedTrafficRecord[];
  rejected: AdapterIssue[];
  duplicateExternalIds: string[];
};

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Convert a validated provider record to the internal event contract.
 * Collection consent is enforced at this boundary for event-level ingestion.
 */
export function normalizeExternalTrafficRecord(input: unknown): {
  success: true;
  data: NormalizedTrafficRecord;
} | {
  success: false;
  issues: AdapterIssue[];
} {
  const parsed = ExternalTrafficRecordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: [{
        externalId: typeof (input as any)?.externalId === "string" ? (input as any).externalId : undefined,
        code: "invalid_record",
        message: parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; "),
      }],
    };
  }

  const record = parsed.data;
  if (record.consent !== "granted") {
    return {
      success: false,
      issues: [{
        externalId: record.externalId,
        code: "consent_not_granted",
        message: "Event-level ingestion requires explicit granted consent in this adapter contract.",
      }],
    };
  }

  const eventCandidate = {
    eventId: record.externalId,
    occurredAt: record.occurredAt,
    workspaceId: record.workspaceId,
    sessionId: record.sessionId,
    eventName: record.eventName,
    landingUrl: record.landingUrl,
    referrerUrl: record.referrerUrl,
    userAgent: record.userAgent,
    utmSource: record.source,
    utmMedium: record.medium,
    utmCampaign: record.campaign,
    consent: record.consent,
    value: record.conversionValue,
    currency: record.currency,
  };
  const eventParsed = validateAttributionEvent(eventCandidate);
  if (!eventParsed.success) {
    return {
      success: false,
      issues: [{
        externalId: record.externalId,
        code: "invalid_record",
        message: eventParsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; "),
      }],
    };
  }

  return {
    success: true,
    data: {
      provider: record.provider,
      externalId: record.externalId,
      event: eventParsed.data,
      classification: classifyTrafficSource({
        referrerUrl: record.referrerUrl,
        userAgent: record.userAgent,
        utmSource: record.source,
        utmMedium: record.medium,
      }),
    },
  };
}

/** Deterministic in-batch idempotency guard; persistence must enforce this too. */
export function normalizeTrafficBatch(inputs: unknown[]): AdapterBatchResult {
  const accepted: NormalizedTrafficRecord[] = [];
  const rejected: AdapterIssue[] = [];
  const duplicateExternalIds: string[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    const result = normalizeExternalTrafficRecord(input);
    if (!result.success) {
      rejected.push(...result.issues);
      continue;
    }
    const key = result.data.provider + ":" + result.data.externalId;
    if (seen.has(key)) {
      duplicateExternalIds.push(key);
      continue;
    }
    seen.add(key);
    accepted.push(result.data);
  }
  return { accepted, rejected, duplicateExternalIds };
}

/**
 * Minimal GA4 Data API row contract. The actual Data API request, OAuth scope,
 * property authorization and pagination belong in a separately reviewed
 * read-only connector. GA4 aggregate rows are not treated as individual events.
 */
export type Ga4ReportRow = {
  dimensionValues?: Array<{ value?: string | null }>;
  metricValues?: Array<{ value?: string | null }>;
};

export type Ga4RowMapping = {
  sessionSource: string | null;
  sessionMedium: string | null;
  sessionCampaignName: string | null;
  pageReferrer: string | null;
  landingPage: string | null;
  sessions: number;
  keyEvents: number;
  totalRevenue: number | null;
};

export function mapGa4ReportRow(row: Ga4ReportRow): Ga4RowMapping | null {
  const dimensions = row.dimensionValues || [];
  const metrics = row.metricValues || [];
  if (dimensions.length < 5 || metrics.length < 3) return null;

  const sessions = asFiniteNumber(metrics[0]?.value);
  const keyEvents = asFiniteNumber(metrics[1]?.value);
  const revenueRaw = metrics[2]?.value;
  const totalRevenue = revenueRaw == null || revenueRaw === ""
    ? null
    : asFiniteNumber(revenueRaw);

  if (sessions == null || keyEvents == null || (revenueRaw != null && revenueRaw !== "" && totalRevenue == null)) return null;

  return {
    sessionSource: dimensions[0]?.value || null,
    sessionMedium: dimensions[1]?.value || null,
    sessionCampaignName: dimensions[2]?.value || null,
    pageReferrer: dimensions[3]?.value || null,
    landingPage: dimensions[4]?.value || null,
    sessions,
    keyEvents,
    totalRevenue,
  };
}

export function classifyGa4Row(row: Ga4RowMapping): SourceClassification {
  return classifyTrafficSource({
    utmSource: row.sessionSource,
    utmMedium: row.sessionMedium,
    referrerUrl: row.pageReferrer || undefined,
  });
}

export type ConversionInput = {
  conversionId: string;
  workspaceId: string;
  occurredAt: string;
  sourceEventIds: string[];
  value: number;
  currency: string;
  status: "confirmed" | "pending" | "reversed";
};

export const ConversionInputSchema = z.object({
  conversionId: z.string().min(1).max(200),
  workspaceId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  sourceEventIds: z.array(z.string().min(1).max(160)).max(1000),
  value: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(["confirmed", "pending", "reversed"]),
}).strict();

export type RevenueSummary = {
  workspaceId: string;
  currency: string;
  confirmedConversions: number;
  confirmedRevenue: number;
  confirmedRevenueMinor: number;
  currencyFractionDigits: number;
  pendingConversions: number;
  reversedConversions: number;
};

function currencyFractionDigits(currency: string): number | null {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return null;
  }
}

export function aggregateRevenue(inputs: unknown[]): {
  summaries: RevenueSummary[];
  rejected: AdapterIssue[];
  duplicateConversionIds: string[];
} {
  const groups = new Map<string, RevenueSummary>();
  const rejected: AdapterIssue[] = [];
  const duplicateConversionIds: string[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    const parsed = ConversionInputSchema.safeParse(input);
    if (!parsed.success) {
      rejected.push({
        externalId: typeof (input as any)?.conversionId === "string" ? (input as any).conversionId : undefined,
        code: "invalid_record",
        message: parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; "),
      });
      continue;
    }

    const conversion = parsed.data;
    const fractionDigits = currencyFractionDigits(conversion.currency);
    if (fractionDigits == null) {
      rejected.push({ externalId: conversion.conversionId, code: "invalid_currency", message: "Currency code is not supported by the runtime currency registry." });
      continue;
    }
    const dedupeKey = conversion.workspaceId + ":" + conversion.conversionId;
    if (seen.has(dedupeKey)) {
      duplicateConversionIds.push(dedupeKey);
      continue;
    }
    const key = conversion.workspaceId + ":" + conversion.currency;
    const summary = groups.get(key) || {
      workspaceId: conversion.workspaceId,
      currency: conversion.currency,
      confirmedConversions: 0,
      confirmedRevenue: 0,
      confirmedRevenueMinor: 0,
      currencyFractionDigits: fractionDigits,
      pendingConversions: 0,
      reversedConversions: 0,
    };

    const scale = 10 ** summary.currencyFractionDigits;
    const scaledValue = conversion.value * scale;
    const minorUnits = Math.round(scaledValue);
    if (!Number.isSafeInteger(minorUnits) || Math.abs(scaledValue - minorUnits) > 1e-7) {
      rejected.push({ externalId: conversion.conversionId, code: "invalid_record", message: "Revenue value exceeds currency precision or safe integer limits." });
      continue;
    }

    seen.add(dedupeKey);

    if (conversion.status === "confirmed") {
      const nextTotalMinor = summary.confirmedRevenueMinor + minorUnits;
      if (!Number.isSafeInteger(nextTotalMinor)) {
        rejected.push({ externalId: conversion.conversionId, code: "invalid_record", message: "Aggregated revenue exceeds safe integer limits." });
        continue;
      }
      summary.confirmedConversions += 1;
      summary.confirmedRevenueMinor = nextTotalMinor;
      summary.confirmedRevenue = summary.confirmedRevenueMinor / scale;
    } else if (conversion.status === "pending") {
      summary.pendingConversions += 1;
    } else {
      summary.reversedConversions += 1;
    }
    groups.set(key, summary);
  }

  return { summaries: [...groups.values()], rejected, duplicateConversionIds };
}
