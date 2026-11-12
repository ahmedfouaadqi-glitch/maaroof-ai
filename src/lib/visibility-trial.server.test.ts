import { afterEach, describe, expect, it } from "vitest";
import {
  classifyEntityType,
  getTrustedClientIp,
  hashTrialSignal,
  normalizeTrialEntityName,
  trialEntityFingerprint,
  verifyTrialIpRisk,
} from "./visibility-trial.server";

const previousSecret = process.env.TRIAL_IDENTITY_SECRET;
const previousIpUrl = process.env.IP_RISK_CHECK_URL;
const previousIpToken = process.env.IP_RISK_CHECK_TOKEN;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.TRIAL_IDENTITY_SECRET;
  else process.env.TRIAL_IDENTITY_SECRET = previousSecret;
  if (previousIpUrl === undefined) delete process.env.IP_RISK_CHECK_URL;
  else process.env.IP_RISK_CHECK_URL = previousIpUrl;
  if (previousIpToken === undefined) delete process.env.IP_RISK_CHECK_TOKEN;
  else process.env.IP_RISK_CHECK_TOKEN = previousIpToken;
});

describe("visibility trial identity and risk helpers", () => {
  it("normalizes Arabic diacritics, Alef variants and punctuation", () => {
    expect(normalizeTrialEntityName("  مَعْرُوف — أَحْمَد  ")).toBe("معروف احمد");
  });

  it("uses the same entity lock regardless of manual or automatic type", () => {
    process.env.TRIAL_IDENTITY_SECRET = "test-secret-that-is-at-least-32-characters-long";
    expect(trialEntityFingerprint("MAAROOF Ai", "person"))
      .toBe(trialEntityFingerprint("maaroof-ai", "organization"));
  });

  it("uses purpose-separated HMACs for privacy-preserving signals", () => {
    process.env.TRIAL_IDENTITY_SECRET = "test-secret-that-is-at-least-32-characters-long";
    expect(hashTrialSignal("same", "device")).not.toBe(hashTrialSignal("same", "ip"));
  });

  it("fails closed when the identity secret is missing", () => {
    delete process.env.TRIAL_IDENTITY_SECRET;
    expect(() => hashTrialSignal("value", "device")).toThrow("trial_identity_secret_missing");
  });

  it("only classifies clear manual or heuristic cases", () => {
    expect(classifyEntityType("person", "Ahmed")).toBe("person");
    expect(classifyEntityType("auto", "Dr Ahmed is an author")).toBe("person");
    expect(classifyEntityType("auto", "Acme Company Ltd")).toBe("organization");
    expect(classifyEntityType("auto", "MAAROOF")).toBe("unknown");
  });

  it("accepts trusted edge IP headers and rejects missing or forwarded lists", () => {
    expect(getTrustedClientIp(new Request("https://example.com", { headers: { "cf-connecting-ip": "203.0.113.4" } }))).toBe("203.0.113.4");
    expect(getTrustedClientIp(new Request("https://example.com", { headers: { "x-real-ip": "203.0.113.4, 10.0.0.1" } }))).toBeNull();
    expect(getTrustedClientIp(new Request("https://example.com"))).toBeNull();
  });

  it("fails closed when no server-side IP intelligence provider is configured", async () => {
    delete process.env.IP_RISK_CHECK_URL;
    delete process.env.IP_RISK_CHECK_TOKEN;
    await expect(verifyTrialIpRisk("203.0.113.4")).rejects.toThrow("ip_risk_service_not_configured");
  });
});
