import { z } from "zod";

/**
 * MAAROOF Attribution Intelligence — pure domain foundation.
 *
 * This module deliberately does not collect requests, persist events, call GA4,
 * or access Supabase. It classifies only explicit evidence supplied by an adapter.
 */

export const ATTRIBUTION_MODELS = [
  "first_touch",
  "last_touch",
  "last_non_direct",
  "linear",
  "time_decay",
] as const;

export type AttributionModel = (typeof ATTRIBUTION_MODELS)[number];
export type TrafficChannel =
  | "ai_referral"
  | "organic_search"
  | "paid_search"
  | "social"
  | "email"
  | "referral"
  | "direct"
  | "crawler"
  | "unknown";

export type EvidenceConfidence = "high" | "medium" | "low";

export const AttributionEventSchema = z.object({
  eventId: z.string().min(1).max(160),
  occurredAt: z.string().datetime(),
  workspaceId: z.string().uuid().nullable(),
  sessionId: z.string().min(1).max(160).nullable(),
  anonymousId: z.string().max(160).nullable().optional(),
  eventName: z.string().min(1).max(100),
  landingUrl: z.string().url().optional(),
  referrerUrl: z.string().url().optional(),
  userAgent: z.string().max(2000).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  consent: z.enum(["granted", "denied", "unknown"]).default("unknown"),
  value: z.number().finite().nonnegative().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.value === undefined) !== (value.currency === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "value_and_currency_must_be_supplied_together", path: ["currency"] });
  }
});

export type AttributionEvent = z.infer<typeof AttributionEventSchema>;

export type SourceClassification = {
  channel: TrafficChannel;
  source: string | null;
  medium: string | null;
  confidence: EvidenceConfidence;
  evidence: "user_agent" | "utm" | "referrer" | "no_referrer" | "insufficient";
  reason: string;
};

const AI_REFERRER_HOSTS = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "claude.ai",
  "copilot.microsoft.com",
  "you.com",
  "poe.com",
  "deepseek.com",
  "mistral.ai",
  "kimi.com",
  "qwen.ai",
]);

const SEARCH_HOSTS = new Set([
  "google.com", "bing.com", "search.yahoo.com", "duckduckgo.com",
  "yandex.com", "baidu.com", "ecosia.org", "brave.com",
]);

const SOCIAL_HOSTS = new Set([
  "facebook.com", "instagram.com", "linkedin.com", "x.com",
  "twitter.com", "tiktok.com", "youtube.com", "reddit.com",
  "pinterest.com", "threads.net",
]);

const CRAWLER_UA_MARKERS = [
  "crawler", "spider", "slurp", "gptbot", "chatgpt-user",
  "oai-searchbot", "claudebot", "claude-web", "perplexitybot",
  "google-extended", "googlebot", "bingbot", "bytespider",
  "facebookexternalhit", "linkedinbot", "applebot", "ccbot",
];

function safeHostname(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostMatches(host: string, known: Set<string>): boolean {
  return [...known].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function normalizedTag(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function isAiLabel(value?: string): boolean {
  const label = normalizedTag(value);
  return [...AI_REFERRER_HOSTS].some((host) => label === host || label === host.split(".")[0])
    || ["chatgpt", "openai", "perplexity", "gemini", "claude", "copilot", "deepseek", "mistral", "kimi", "qwen", "poe", "you"].includes(label);
}

/**
 * Conservative source classification:
 * - known AI referrer or explicit AI UTM => AI referral;
 * - known crawler UA => crawler, never a human session;
 * - missing referrer => direct, never inferred to be AI;
 * - unrecognized/invalid evidence => unknown.
 */
export function classifyTrafficSource(input: {
  referrerUrl?: string | null;
  landingUrl?: string | null;
  userAgent?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
}): SourceClassification {
  const ua = (input.userAgent || "").toLowerCase();
  if (CRAWLER_UA_MARKERS.some((marker) => ua.includes(marker)) || /(?:^|[\\s;(/])(?:[a-z0-9._-]*bot)(?:[\\s/;)]|$)/i.test(ua)) {
    return {
      channel: "crawler", source: null, medium: "bot",
      confidence: "medium", evidence: "user_agent",
      reason: "User-agent matches a crawler marker; classification is provisional because user-agent strings can be spoofed.",
    };
  }

  const utmSource = normalizedTag(input.utmSource || undefined);
  const utmMedium = normalizedTag(input.utmMedium || undefined);
  if (utmSource === "direct" || (utmMedium === "none" && utmSource !== "notset")) {
    return { channel: "direct", source: "(direct)", medium: "(none)", confidence: "medium", evidence: "utm", reason: "Analytics source fields explicitly identify direct traffic." };
  }
  if (utmSource === "notset" || utmMedium === "notset") {
    return { channel: "unknown", source: null, medium: null, confidence: "low", evidence: "insufficient", reason: "Analytics provider marked source or medium as not set." };
  }
  if (utmSource && isAiLabel(utmSource)) {
    return {
      channel: "ai_referral", source: utmSource, medium: utmMedium || "referral",
      confidence: "medium", evidence: "utm",
      reason: "Explicit campaign source labels an AI answer platform; campaign tags are client-supplied and not independently verified.",
    };
  }

  const host = safeHostname(input.referrerUrl || undefined);
  const landingHost = safeHostname(input.landingUrl || undefined);
  if (host && landingHost && host === landingHost) {
    return { channel: "direct", source: "(same-site)", medium: "internal", confidence: "medium", evidence: "referrer", reason: "Same-host navigation referrer is not treated as a new acquisition source." };
  }
  if (host && hostMatches(host, AI_REFERRER_HOSTS)) {
    return {
      channel: "ai_referral", source: host, medium: "referral",
      confidence: "medium", evidence: "referrer",
      reason: "HTTP referrer hostname matches a recognized AI answer platform; referrer data can be omitted or manipulated.",
    };
  }

  if (utmSource) {
    if (utmMedium === "organic") {
      return { channel: "organic_search", source: utmSource, medium: "organic", confidence: "medium", evidence: "utm", reason: "Client-supplied organic search campaign tagging." };
    }
    if (/^(cpc|ppc|paidsearch|paid-search)$/.test(utmMedium)) {
      return { channel: "paid_search", source: utmSource, medium: utmMedium, confidence: "medium", evidence: "utm", reason: "Client-supplied paid-search campaign tagging." };
    }
    if (/^(email|e-mail)$/.test(utmMedium)) {
      return { channel: "email", source: utmSource, medium: utmMedium, confidence: "medium", evidence: "utm", reason: "Client-supplied email campaign tagging." };
    }
    if (/^(social|social-network|social-media)$/.test(utmMedium)) {
      return { channel: "social", source: utmSource, medium: utmMedium, confidence: "medium", evidence: "utm", reason: "Client-supplied social campaign tagging." };
    }
    return { channel: "referral", source: utmSource, medium: utmMedium || null, confidence: "medium", evidence: "utm", reason: "Explicit campaign source is present but is not a recognized AI source." };
  }

  if (host && hostMatches(host, SEARCH_HOSTS)) {
    return { channel: "organic_search", source: host, medium: "organic", confidence: "medium", evidence: "referrer", reason: "Referrer hostname matches a recognized search engine; client-provided referrer data is not independently verified." };
  }
  if (host && hostMatches(host, SOCIAL_HOSTS)) {
    return { channel: "social", source: host, medium: "referral", confidence: "medium", evidence: "referrer", reason: "Referrer hostname matches a recognized social platform; client-provided referrer data is not independently verified." };
  }
  if (host) {
    return { channel: "referral", source: host, medium: "referral", confidence: "medium", evidence: "referrer", reason: "A valid external referrer exists but is not in a recognized channel registry." };
  }
  if (!input.referrerUrl && !input.utmSource) {
    return { channel: "direct", source: "(direct)", medium: "(none)", confidence: "low", evidence: "no_referrer", reason: "No referrer or campaign source was supplied; this is not evidence of AI-origin traffic." };
  }
  return { channel: "unknown", source: null, medium: null, confidence: "low", evidence: "insufficient", reason: "Source evidence was supplied but could not be parsed reliably." };
}

export type Touchpoint = {
  eventId: string;
  workspaceId: string | null;
  occurredAt: string;
  channel: TrafficChannel;
  source: string | null;
};

export type Conversion = {
  conversionId: string;
  workspaceId: string | null;
  occurredAt: string;
  value?: number;
  currency?: string;
};

export type AttributionCredit = {
  eventId: string;
  channel: TrafficChannel;
  source: string | null;
  credit: number;
};

export type AttributionResult = {
  model: AttributionModel;
  conversionId: string;
  credits: AttributionCredit[];
  unattributed: boolean;
  reason?: string;
};

/** Allocate one conversion across same-workspace touchpoints preceding it. */
export function attributeConversion(
  conversion: Conversion,
  touchpoints: Touchpoint[],
  model: AttributionModel,
  options: { halfLifeDays?: number; eligibleEventIds?: readonly string[] } = {},
): AttributionResult {
  const eligible = touchpoints
    .filter((touch) =>
      touch.workspaceId === conversion.workspaceId
      && (!options.eligibleEventIds || options.eligibleEventIds.includes(touch.eventId))
      && touch.channel !== "crawler"
      && Number.isFinite(Date.parse(touch.occurredAt))
      && Date.parse(touch.occurredAt) <= Date.parse(conversion.occurredAt),
    )
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  if (!eligible.length) {
    return { model, conversionId: conversion.conversionId, credits: [], unattributed: true, reason: "no_eligible_same_workspace_touchpoints" };
  }

  let selected = eligible;
  let weights: number[];

  if (model === "first_touch") {
    selected = [eligible[0]];
    weights = [1];
  } else if (model === "last_touch") {
    selected = [eligible[eligible.length - 1]];
    weights = [1];
  } else if (model === "last_non_direct") {
    const nonDirect = eligible.filter((touch) => touch.channel !== "direct" && touch.channel !== "unknown");
    selected = [nonDirect[nonDirect.length - 1] || eligible[eligible.length - 1]];
    weights = [1];
  } else if (model === "linear") {
    weights = eligible.map(() => 1 / eligible.length);
  } else {
    const halfLifeDays = Math.max(0.01, options.halfLifeDays ?? 7);
    const latestTouchTime = Date.parse(eligible[eligible.length - 1].occurredAt);
    weights = eligible.map((touch) => {
      const ageDays = Math.max(0, (latestTouchTime - Date.parse(touch.occurredAt)) / 86_400_000);
      return Math.pow(0.5, ageDays / halfLifeDays);
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    weights = weights.map((weight) => weight / total);
  }

  return {
    model,
    conversionId: conversion.conversionId,
    credits: selected.map((touch, index) => ({
      eventId: touch.eventId,
      channel: touch.channel,
      source: touch.source,
      credit: weights[index],
    })),
    unattributed: false,
  };
}

/** Validate event identity and basic business constraints without persistence. */
export function validateAttributionEvent(input: unknown) {
  return AttributionEventSchema.safeParse(input);
}
