import { describe, it, expect } from "vitest";
import {
  hasUsableScrapeEvidence, classifyUnusableScrape, preferredReadFailure, PublicReadFailure, sourceLabel, parseRetryAfterMs,
} from "./fetch-order";

describe("scrape quality gate", () => {
  it("accepts public social profile metadata when a crawler returns little markdown", () => {
    expect(hasUsableScrapeEvidence({
      data: {
        markdown: "",
        metadata: {
          title: "Example brand (@example) · Instagram",
          description: "Public profile for Example brand with official product information and public posts.",
          statusCode: 200,
        },
      },
    })).toBe(true);
  });

  it("rejects title-only login placeholders so the next source can be tried", () => {
    expect(hasUsableScrapeEvidence({
      data: { markdown: "Log in to Instagram", metadata: { title: "Instagram", statusCode: 200 } },
    })).toBe(false);
  });

  it("rejects login shells even when the response contains generic metadata", () => {
    expect(hasUsableScrapeEvidence({
      data: { markdown: "Log in to Instagram to view photos and videos.", metadata: {
        title: "Instagram", description: "Log in or sign up to view posts and follow creators.",
        statusCode: 200,
      } },
    })).toBe(false);
  });

  it("accepts descriptive profile metadata when the extracted body mentions login controls", () => {
    expect(hasUsableScrapeEvidence({
      data: { markdown: "Public profile. Log in to Instagram to follow this account.", metadata: {
        title: "Example Couture (@example) · Instagram",
        description: "Official Example Couture profile sharing fashion collections, product details, and new seasonal releases.",
        statusCode: 200,
      } },
    })).toBe(true);
  });

  it("rejects empty responses and HTTP errors", () => {
    expect(hasUsableScrapeEvidence({ data: { markdown: "", metadata: {} } })).toBe(false);
    expect(hasUsableScrapeEvidence({ data: { markdown: "This would otherwise be long enough to count", metadata: { statusCode: 403 } } })).toBe(false);
  });

  it("still accepts substantive article text", () => {
    expect(hasUsableScrapeEvidence({ data: { markdown: "A public page with sufficiently long article body content and headings to inspect for several audit axes.", metadata: { statusCode: 200 } } })).toBe(true);
  });
});

describe("provider-neutral read failure explanations", () => {
  it("uses a gentle Instagram-specific message only when the page evidence supports it", () => {
    expect(classifyUnusableScrape({
      data: { markdown: "", metadata: { title: "Instagram", description: "", statusCode: 403 } },
    }, "https://www.instagram.com/example")).toBe("instagram_automated_access_denied");

    expect(classifyUnusableScrape({
      data: { markdown: "", metadata: { title: "Instagram", description: "", statusCode: 429 } },
    }, "https://instagram.com/example")).toBe("instagram_rate_limited");
  });

  it("does not blame Instagram when the reading route alone reports a limit", () => {
    expect(classifyUnusableScrape({
      data: { markdown: "", metadata: { title: "", description: "", statusCode: 429 } },
    }, "https://example.com/page")).toBe("target_rate_limited");
  });

  it("prefers a confirmed target-side denial over an unrelated reading-route limit", () => {
    const failures = [
      new PublicReadFailure("reader_rate_limited", "reader", 429),
      new PublicReadFailure("instagram_automated_access_denied", "target", 403),
    ];
    expect(preferredReadFailure(failures).readIssue).toBe("instagram_automated_access_denied");
  });

  it("uses neutral source labels and does not expose vendor names", () => {
    const labels = [
      sourceLabel("firecrawl", "ar"),
      sourceLabel("firecrawl", "en"),
      sourceLabel("apidirect", "ar"),
      sourceLabel("apidirect", "en"),
    ].join(" ").toLowerCase();
    expect(labels).not.toContain("firecrawl");
    expect(labels).not.toContain("apidirect");
    expect(labels).not.toContain("api direct");
  });
});

describe("retry-after handling", () => {
  it("parses a delay in seconds without waiting", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
  });

  it("treats an invalid or absent retry-after as unknown", () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs("not-a-delay")).toBeUndefined();
  });
});

