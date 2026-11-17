import { createHash, randomBytes } from "node:crypto";

export type ShareReportKind = "client" | "technical";
export type ShareGrant = {
  grantId: string;
  reportId: string;
  reportVersion: number;
  reportKind: ShareReportKind;
  tokenHash: string;
  allowedFormats: string[];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type NewShareGrantInput = {
  grantId: string;
  reportId: string;
  reportVersion: number;
  reportKind: ShareReportKind;
  allowedFormats: string[];
  createdAt: string;
  expiresAt: string;
  allowTechnicalClientShare?: boolean;
};

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createShareGrant(input: NewShareGrantInput): { token: string; grant: ShareGrant } {
  if (input.reportKind === "technical" && input.allowTechnicalClientShare !== true) {
    throw new Error("technical_report_sharing_forbidden");
  }
  if (!input.allowedFormats.length || input.allowedFormats.some((format) => !/^(pdf|pptx|html)$/.test(format))) {
    throw new Error("invalid_share_formats");
  }
  const expires = Date.parse(input.expiresAt);
  const created = Date.parse(input.createdAt);
  if (!Number.isFinite(expires) || !Number.isFinite(created) || expires <= created) {
    throw new Error("invalid_share_expiry");
  }
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    grant: {
      grantId: input.grantId,
      reportId: input.reportId,
      reportVersion: input.reportVersion,
      reportKind: input.reportKind,
      tokenHash: hashShareToken(token),
      allowedFormats: [...new Set(input.allowedFormats)],
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      revokedAt: null,
    },
  };
}

export function shareGrantStatus(grant: ShareGrant, now = new Date().toISOString()): "active" | "revoked" | "expired" {
  if (grant.revokedAt) return "revoked";
  const nowMs = Date.parse(now);
  const expiryMs = Date.parse(grant.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs) || expiryMs <= nowMs) return "expired";
  return "active";
}

export function matchesShareToken(grant: ShareGrant, token: string): boolean {
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return false;
  return hashShareToken(token) === grant.tokenHash;
}
