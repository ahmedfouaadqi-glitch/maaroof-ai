import { describe, expect, it } from "vitest";
import { createShareGrant, matchesShareToken, shareGrantStatus } from "./share-grant.server";

const input = {
  grantId: "grant-1", reportId: "report-1", reportVersion: 2, reportKind: "client" as const,
  allowedFormats: ["pdf", "pptx"], createdAt: "2026-11-17T10:00:00Z", expiresAt: "2026-11-18T10:00:00Z",
};

describe("secure share grant primitives", () => {
  it("creates a high-entropy token while storing only its hash", () => {
    const { token, grant } = createShareGrant(input);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,60}$/);
    expect(grant.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(grant.tokenHash).not.toBe(token);
    expect(matchesShareToken(grant, token)).toBe(true);
    expect(matchesShareToken(grant, "wrong-token")).toBe(false);
  });

  it("blocks technical report sharing unless explicitly allowed", () => {
    expect(() => createShareGrant({ ...input, reportKind: "technical" })).toThrow("technical_report_sharing_forbidden");
    expect(() => createShareGrant({ ...input, reportKind: "technical", allowTechnicalClientShare: true })).not.toThrow();
  });

  it("rejects invalid expiry and formats", () => {
    expect(() => createShareGrant({ ...input, expiresAt: input.createdAt })).toThrow("invalid_share_expiry");
    expect(() => createShareGrant({ ...input, allowedFormats: ["json"] })).toThrow("invalid_share_formats");
  });

  it("distinguishes active, revoked and expired grants", () => {
    const { grant } = createShareGrant(input);
    expect(shareGrantStatus(grant, "2026-11-17T12:00:00Z")).toBe("active");
    expect(shareGrantStatus({ ...grant, revokedAt: "2026-11-17T11:00:00Z" }, "2026-11-17T12:00:00Z")).toBe("revoked");
    expect(shareGrantStatus(grant, "2026-11-19T12:00:00Z")).toBe("expired");
  });
});
