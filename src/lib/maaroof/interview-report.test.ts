import { describe, expect, it } from "vitest";
import { createInterviewState } from "@/lib/maaroof/interview-engine";
import { buildInterviewReport } from "@/lib/maaroof/interview-report";

describe("evidence-aware interview reports", () => {
  it("builds only selected domain sections and marks missing evidence honestly", () => {
    const state = createInterviewState({
      targetType: "company",
      domains: ["seo", "geo"],
      locale: "en",
    });
    state.answers.objective = {
      questionId: "objective",
      status: "answered",
      value: "Increase qualified leads",
      source: "user",
      updatedAt: "2026-10-18T00:00:00Z",
    };
    const report = buildInterviewReport({
      targetType: "company",
      targetName: "Example Company",
      goal: "Increase qualified leads",
      domains: ["seo", "geo"],
      locale: "en",
      state,
      sources: [],
      generatedAt: "2026-10-18T12:00:00Z",
    });

    expect(report.evidenceLevel).toBe("insufficient");
    expect(report.sections.map((item) => item.id)).toEqual(["general", "seo", "geo"]);
    expect(report.sections.find((item) => item.id === "seo")?.measurementNote).toContain("No crawl");
    expect(report.sections.find((item) => item.id === "geo")?.measurementNote).toContain("No live AI-engine");
    expect(report.sections.find((item) => item.id === "general")?.gaps).toContain("Audience");
  });

  it("uses distinct source domains to describe the evidence level without inventing performance results", () => {
    const state = createInterviewState({
      targetType: "brand",
      domains: ["aeo"],
      locale: "ar",
    });
    const report = buildInterviewReport({
      targetType: "brand",
      targetName: "علامة مثال",
      domains: ["aeo"],
      locale: "ar",
      state,
      sources: [
        { title: "One", url: "https://one.example/a", domain: "one.example", description: "", snippet: "" },
        { title: "Two", url: "https://two.example/b", domain: "two.example", description: "", snippet: "" },
        { title: "Three", url: "https://three.example/c", domain: "three.example", description: "", snippet: "" },
      ],
    });

    expect(report.evidenceLevel).toBe("multi_source");
    expect(report.sections.map((item) => item.id)).toEqual(["general", "aeo"]);
    expect(report.sections[1].recommendations[0]).toContain("مصادر");
    expect(JSON.stringify(report)).not.toContain("ranked #1");
  });
});
