import { describe, it, expect } from "vitest";
import { hasUsableScrapeEvidence } from "./fetch-order";

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
