import { describe, expect, it } from "vitest";
import {
  attributeConversion,
  classifyTrafficSource,
  validateAttributionEvent,
  type Touchpoint,
} from "./domain";

describe("classifyTrafficSource", () => {
  it("recognizes a known AI answer-engine referrer", () => {
    expect(classifyTrafficSource({ referrerUrl: "https://chatgpt.com/" }).channel).toBe("ai_referral");
  });

  it("recognizes explicitly tagged AI campaign traffic", () => {
    const result = classifyTrafficSource({ utmSource: "perplexity", utmMedium: "referral" });
    expect(result.channel).toBe("ai_referral");
    expect(result.evidence).toBe("utm");
  });

  it("keeps GA4 Direct / None labels classified as Direct", () => {
    expect(classifyTrafficSource({ utmSource: "(direct)", utmMedium: "(none)" }).channel).toBe("direct");
  });

  it("does not treat a same-host navigation referrer as a new referral source", () => {
    const result = classifyTrafficSource({
      referrerUrl: "https://shop.example.com/products",
      landingUrl: "https://shop.example.com/cart",
    });
    expect(result.channel).toBe("direct");
    expect(result.source).toBe("(same-site)");
  });

  it("keeps provider not-set labels unknown rather than direct", () => {
    expect(classifyTrafficSource({ utmSource: "(not set)", utmMedium: "(not set)" }).channel).toBe("unknown");
  });

  it("does not infer AI traffic from a missing referrer", () => {
    const result = classifyTrafficSource({});
    expect(result.channel).toBe("direct");
    expect(result.channel).not.toBe("ai_referral");
  });

  it("classifies known crawler user agents separately", () => {
    expect(classifyTrafficSource({ userAgent: "Mozilla/5.0 GPTBot/1.0" }).channel).toBe("crawler");
  });

  it("classifies explicitly tagged organic search correctly", () => {
    expect(classifyTrafficSource({ utmSource: "google", utmMedium: "organic" }).channel).toBe("organic_search");
  });

  it("does not classify an unrelated user-agent containing the letters bot as a crawler", () => {
    expect(classifyTrafficSource({ userAgent: "Mozilla/5.0 (compatible; ExampleBrowser/1.0)" }).channel).toBe("direct");
  });

  it("recognizes organic search referrers", () => {
    expect(classifyTrafficSource({ referrerUrl: "https://www.google.com/search?q=brand" }).channel).toBe("organic_search");
  });
});

const touches: Touchpoint[] = [
  { eventId: "a", workspaceId: "11111111-1111-4111-8111-111111111111", occurredAt: "2026-01-01T10:00:00.000Z", channel: "organic_search", source: "google.com" },
  { eventId: "crawler", workspaceId: "11111111-1111-4111-8111-111111111111", occurredAt: "2026-01-01T11:00:00.000Z", channel: "crawler", source: null },
  { eventId: "b", workspaceId: "11111111-1111-4111-8111-111111111111", occurredAt: "2026-01-02T10:00:00.000Z", channel: "ai_referral", source: "chatgpt.com" },
  { eventId: "other-workspace", workspaceId: "22222222-2222-4222-8222-222222222222", occurredAt: "2026-01-02T11:00:00.000Z", channel: "social", source: "linkedin.com" },
  { eventId: "future", workspaceId: "11111111-1111-4111-8111-111111111111", occurredAt: "2026-01-04T10:00:00.000Z", channel: "direct", source: "(direct)" },
];

const conversion = {
  conversionId: "conv-1",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  occurredAt: "2026-01-03T10:00:00.000Z",
};

describe("attributeConversion", () => {
  it("keeps attribution within the conversion workspace and before conversion time", () => {
    const result = attributeConversion(conversion, touches, "linear");
    expect(result.credits.map((credit) => credit.eventId)).toEqual(["a", "b"]);
  });

  it("excludes crawler events from human journey attribution", () => {
    const result = attributeConversion(conversion, touches, "last_touch");
    expect(result.credits.map((credit) => credit.eventId)).toEqual(["b"]);
  });

  it("allocates first-touch and last-touch credit deterministically", () => {
    expect(attributeConversion(conversion, touches, "first_touch").credits[0].eventId).toBe("a");
    expect(attributeConversion(conversion, touches, "last_touch").credits[0].eventId).toBe("b");
  });

  it("does not let a later direct touch overwrite a known non-direct touch in last-non-direct", () => {
    const withDirect: Touchpoint[] = [
      ...touches,
      { eventId: "direct", workspaceId: conversion.workspaceId, occurredAt: "2026-01-02T18:00:00.000Z", channel: "direct", source: "(direct)" },
    ];
    expect(attributeConversion(conversion, withDirect, "last_non_direct").credits[0].eventId).toBe("b");
  });

  it("keeps time-decay weights finite for very old touchpoints", () => {
    const oldTouches: Touchpoint[] = [
      { eventId: "old", workspaceId: conversion.workspaceId, occurredAt: "1900-01-01T00:00:00.000Z", channel: "organic_search", source: "google.com" },
      { eventId: "recent", workspaceId: conversion.workspaceId, occurredAt: "2026-01-02T00:00:00.000Z", channel: "ai_referral", source: "chatgpt.com" },
    ];
    const credits = attributeConversion(conversion, oldTouches, "time_decay").credits;
    expect(credits.every((item) => Number.isFinite(item.credit))).toBe(true);
    expect(credits.reduce((sum, item) => sum + item.credit, 0)).toBeCloseTo(1, 10);
  });

  it("normalizes linear and time-decay weights to one", () => {
    for (const model of ["linear", "time_decay"] as const) {
      const credits = attributeConversion(conversion, touches, model).credits;
      expect(credits.reduce((sum, item) => sum + item.credit, 0)).toBeCloseTo(1, 10);
    }
  });

  it("returns an explicit unattributed result when no eligible touchpoint exists", () => {
    const result = attributeConversion({ ...conversion, workspaceId: "33333333-3333-4333-8333-333333333333" }, touches, "last_touch");
    expect(result.unattributed).toBe(true);
    expect(result.reason).toBe("no_eligible_same_workspace_touchpoints");
  });
});

describe("validateAttributionEvent", () => {
  it("rejects invalid workspace identifiers and malformed event payloads", () => {
    expect(validateAttributionEvent({ eventId: "e1", workspaceId: "not-a-uuid" }).success).toBe(false);
  });
});
