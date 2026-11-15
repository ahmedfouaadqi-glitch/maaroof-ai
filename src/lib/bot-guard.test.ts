import { describe, it, expect } from "vitest";
import { isBlockedUserAgent, isSuspiciousSubmission } from "./bot-guard";
describe("bot-guard", () => {
  it("blocks automation and AI crawlers", () => {
    expect(isBlockedUserAgent("curl/8.0")).toBe(true);
    expect(isBlockedUserAgent("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBlockedUserAgent("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe(true);
    expect(isBlockedUserAgent("")).toBe(true);
  });
  it("allows normal browsers", () => {
    expect(isBlockedUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36")).toBe(false);
  });
  it("rejects filled honeypot", () => expect(isSuspiciousSubmission({ honeypot: "x", fill_ms: 9000 })).toBe(true));
  it("rejects under 3 seconds", () => expect(isSuspiciousSubmission({ fill_ms: 2999 })).toBe(true));
  it("accepts 3 seconds or more", () => expect(isSuspiciousSubmission({ honeypot: "", fill_ms: 3000 })).toBe(false));
});
