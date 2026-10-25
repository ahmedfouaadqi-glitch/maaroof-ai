import { describe, it, expect } from "vitest";
import { buildTaskExportPayload } from "@/lib/maaroof/task-export";
import { taskEntity, taskEntityInput } from "@/lib/maaroof/agent-input";

const results = [
  { tool: "known", ok: true, output: { brand: "Mengotti Couture", url: "https://mengotti.example", faqs: [{ q: "Where?", a: "Milan" }], note: "via Firecrawl https://src.example/a" } },
  { tool: "visibility", ok: true, output: { probe: { answers: [{ engine: "chatgpt", mentioned: true, rank: 2, answer: "x", sources: [{ url: "https://cite.example" }] }] } } },
];

describe("task export", () => {
  it("includes engine answers, machine pack for the examined entity, and real links", () => {
    const p = buildTaskExportPayload({ title: "R", goal: "g", finalText: "done", results, lang: "en" });
    const j = JSON.stringify(p);
    expect(j).toContain("ChatGPT");
    expect(j).toContain("Mengotti Couture");
    expect(j).toContain("FAQPage");
    expect(j).toContain("https://cite.example");
    expect(j).not.toMatch(/firecrawl/i);
  });
  it("always includes all five SEO/AEO/GEO/SGE/GSEO cards when tools are missing", () => {
    const p = buildTaskExportPayload({ title: "Partial run", goal: "Audit", finalText: "", results: [], lang: "ar" });
    const headings = p.sections.map((section) => section.heading).join("\n");
    expect(headings).toContain("بطاقة SEO");
    expect(headings).toContain("بطاقة AEO");
    expect(headings).toContain("بطاقة GEO");
    expect(headings).toContain("بطاقة SGE");
    expect(headings).toContain("بطاقة GSEO");
    expect(headings).toContain("90 يوماً");
  });

  it("preserves the exact blind and evidence-audit questions for each answering engine", () => {
    const p = buildTaskExportPayload({
      title: "Question capture",
      goal: "Visibility",
      finalText: "",
      lang: "en",
      results: [{
        tool: "visibility", ok: false,
        output: { probe: {
          query: "Unbiased question text",
          blind_query: "Unbiased question text",
          grounded_question_template: "Evidence template",
          asked: ["chatgpt", "gemini"],
          statuses: { gemini: { status: "timeout", blind_status: "timeout", ms: 300, blind_query: "Unbiased question text" } },
          answers: [{ engine: "chatgpt", mentioned: true, rank: 1, answer: "The answer", blind_query: "Unbiased question text", grounded_query: "Actual evidence audit question", blind_status: "answered", grounded_status: "ok", brands: ["A"], sources: [] }]
        } }
      }]
    });
    const j = JSON.stringify(p);
    expect(j).toContain("Unbiased question text");
    expect(j).toContain("Actual evidence audit question");
    expect(j).toContain("Timed out");
    expect(j).toContain("GEO card");
  });

  it("later steps inherit the examined entity, not the account", () => {
    expect(taskEntity(results)?.brand).toBe("Mengotti Couture");
    expect(taskEntityInput("brand_authority", {}, results).url).toBe("https://mengotti.example");
  });
});
