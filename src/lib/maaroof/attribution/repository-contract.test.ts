import { describe, expect, it } from "vitest";
import {
  AttributionRetentionPolicySchema,
  validateWorkspaceEventBatch,
} from "./repository-contract";

const scope = {
  actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  workspaceId: "11111111-1111-4111-8111-111111111111",
};

function event(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "first_party:event-1",
    occurredAt: "2026-02-01T10:00:00.000Z",
    workspaceId: scope.workspaceId,
    sessionId: "session-1",
    eventName: "page_view",
    consent: "granted",
    ...overrides,
  };
}

describe("validateWorkspaceEventBatch", () => {
  it("accepts only events belonging to the explicit actor workspace scope", () => {
    const result = validateWorkspaceEventBatch(scope, [event()]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.scope.workspaceId).toBe(scope.workspaceId);
      expect(result.events).toHaveLength(1);
    }
  });

  it("rejects cross-workspace and unscoped events atomically", () => {
    const result = validateWorkspaceEventBatch(scope, [
      event(),
      event({ eventId: "other:event", workspaceId: "22222222-2222-4222-8222-222222222222" }),
      event({ eventId: "unscoped:event", workspaceId: null }),
    ]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues).toHaveLength(2);
  });

  it("rejects event batches without explicit granted consent", () => {
    const result = validateWorkspaceEventBatch(scope, [event({ consent: "unknown" })]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]).toContain("consent_not_granted");
  });

  it("rejects invalid workspace actor scope", () => {
    const result = validateWorkspaceEventBatch({ ...scope, actorUserId: "bad-id" }, [event()]);
    expect(result.success).toBe(false);
  });
});

describe("AttributionRetentionPolicySchema", () => {
  it("requires explicit positive retention windows and an explicit revocation policy", () => {
    expect(AttributionRetentionPolicySchema.safeParse({
      eventRetentionDays: 90,
      conversionRetentionDays: 365,
      deleteOnConsentRevoked: true,
    }).success).toBe(true);
    expect(AttributionRetentionPolicySchema.safeParse({
      eventRetentionDays: 0,
      conversionRetentionDays: 365,
      deleteOnConsentRevoked: true,
    }).success).toBe(false);
    expect(AttributionRetentionPolicySchema.safeParse({
      eventRetentionDays: 90,
      conversionRetentionDays: 365,
    }).success).toBe(false);
  });
});
