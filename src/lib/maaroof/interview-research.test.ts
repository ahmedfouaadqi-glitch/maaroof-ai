import { describe, expect, it } from "vitest";
import { buildInterviewResearchQuery, normalizeInterviewResearchSources } from "@/lib/maaroof/interview-research";
import { createInterviewState } from "@/lib/maaroof/interview-engine";

describe("interview research query builder", () => {
  it("builds a bounded localized query from relevant answers only", () => {
    const state = createInterviewState({ targetType: "company", domains: ["seo", "geo"], locale: "ar" });
    state.answers.company_offering = { questionId: "company_offering", status: "answered", value: "نظام حجز للفنادق", source: "user", updatedAt: "2026-10-18T00:00:00Z" };
    state.answers.individual_context = { questionId: "individual_context", status: "answered", value: "معلومة شخصية لا ترسل", source: "user", updatedAt: "2026-10-18T00:00:00Z" };
    const query = buildInterviewResearchQuery({ targetType: "company", targetName: "شركة مثال", goal: "تحسين الظهور", domains: ["seo", "geo"], locale: "ar", state });
    expect(query).toContain("شركة مثال");
    expect(query).toContain("نظام حجز للفنادق");
    expect(query).not.toContain("معلومة شخصية لا ترسل");
    expect(query.length).toBeLessThanOrEqual(300);
  });

  it("does not expose an individual's name in the external query", () => {
    const state = createInterviewState({ targetType: "individual", domains: ["general"], locale: "en" });
    const query = buildInterviewResearchQuery({ targetType: "individual", targetName: "Private Person Name", goal: "Learn SEO", domains: ["general"], locale: "en", state });
    expect(query).not.toContain("Private Person Name");
    expect(query).toContain("Learn SEO");
  });
});

describe("normalize interview research sources", () => {
  it("normalizes web/news results, deduplicates URLs, and rejects unsafe schemes", () => {
    const result = normalizeInterviewResearchSources({ data: { web: [
      { title: "Official page", url: "https://www.example.com/about", description: "Official description", markdown: "Evidence snippet" },
      { title: "Duplicate", url: "https://www.example.com/about" },
      { title: "Unsafe", url: "javascript:alert(1)" },
      { title: "HTTP", url: "http://example.org/page" },
      { title: "Second source", url: "https://news.example.org/story" },
    ], news: [] } });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ title: "Official page", domain: "example.com", snippet: "Evidence snippet" });
    expect(result[1].url).toBe("https://news.example.org/story");
  });

  it("returns an empty list for malformed provider payloads", () => {
    expect(normalizeInterviewResearchSources(null)).toEqual([]);
    expect(normalizeInterviewResearchSources({ data: "unexpected" })).toEqual([]);
  });
});
