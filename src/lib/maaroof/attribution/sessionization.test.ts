import { describe, expect, it } from "vitest";
import { normalizeExternalTrafficRecord, type NormalizedTrafficRecord } from "./adapters";
import { summarizeSessions } from "./sessionization";

const workspaceId = "11111111-1111-4111-8111-111111111111";

function normalized(overrides: Record<string, unknown> = {}): NormalizedTrafficRecord {
  const result = normalizeExternalTrafficRecord({
    provider: "first_party",
    externalId: "event-1",
    occurredAt: "2026-02-01T10:00:00.000Z",
    workspaceId,
    sessionId: "session-1",
    eventName: "page_view",
    source: "chatgpt.com",
    medium: "referral",
    consent: "granted",
    ...overrides,
  });
  if (!result.success) throw new Error("invalid_test_fixture");
  return result.data;
}

describe("summarizeSessions", () => {
  it("counts unique supplied sessions rather than event rows", () => {
    const summary = summarizeSessions([
      normalized({ externalId: "first", occurredAt: "2026-02-01T10:00:00.000Z" }),
      normalized({ externalId: "second", occurredAt: "2026-02-01T10:01:00.000Z" }),
      normalized({ externalId: "third", sessionId: "session-2", source: "google", medium: "organic" }),
    ], workspaceId);
    expect(summary.nonCrawlerSessions).toBe(2);
    expect(summary.aiReferralSessions).toBe(1);
    expect(summary.eventsWithoutSessionId).toBe(0);
  });

  it("does not collide session IDs across analytics providers", () => {
    const summary = summarizeSessions([
      normalized({ provider: "first_party", sessionId: "shared-id" }),
      normalized({ provider: "manual", sessionId: "shared-id", externalId: "manual-event" }),
    ], workspaceId);
    expect(summary.nonCrawlerSessions).toBe(2);
  });

  it("does not count sessions without explicit session IDs", () => {
    const summary = summarizeSessions([
      normalized({ sessionId: null }),
      normalized({ externalId: "second", sessionId: null }),
    ], workspaceId);
    expect(summary.nonCrawlerSessions).toBe(0);
    expect(summary.eventsWithoutSessionId).toBe(2);
  });

  it("excludes crawler-marked sessions from non-crawler session totals", () => {
    const summary = summarizeSessions([
      normalized({ externalId: "human", userAgent: "Mozilla/5.0 Chrome/120" }),
      normalized({ externalId: "crawler", userAgent: "Mozilla/5.0 GPTBot/1.0" }),
    ], workspaceId);
    expect(summary.nonCrawlerSessions).toBe(0);
    expect(summary.crawlerSessions).toBe(1);
  });

  it("isolates sessions by workspace", () => {
    const summary = summarizeSessions([
      normalized(),
      normalized({ externalId: "other", workspaceId: "22222222-2222-4222-8222-222222222222", sessionId: "session-2" }),
    ], workspaceId);
    expect(summary.nonCrawlerSessions).toBe(1);
  });
});
